'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, Camera, Plus, Trash2, Clock, IndianRupee, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Slot {
  id: string;
  startsAt: string;
  isBooked: boolean;
}
interface Doctor {
  id: string;
  name: string;
  photoPath: string | null;
  clinicName: string | null;
  specialty: string;
  qualifications: string | null;
  background: string | null;
  locality: string | null;
  mapsLink: string | null;
  phone: string;
  consultationFee: string;
  isActive: boolean;
  neighborhood: { id: string; name: string };
  slots: Slot[];
}
interface Booking {
  id: string;
  status: 'pending_confirmation' | 'confirmed' | 'paid' | 'cancelled';
  amount: string;
  doctor: { name: string; neighborhood: { name: string } };
  slot: { startsAt: string };
  elderUser: { name: string; phone: string | null };
}

const STATUS_VARIANT: Record<Booking['status'], 'accent' | 'success' | 'danger' | 'muted'> = {
  pending_confirmation: 'accent',
  confirmed: 'accent',
  paid: 'success',
  cancelled: 'muted',
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

/** Self-service for a doctor's own listing(s) — profile, photo, slots, and
 *  the bookings made against them. Only shown when the provider's own
 *  category is doctor (see app/provider/page.tsx). */
export function DoctorSelfService({ initial }: { initial: Doctor[] }) {
  const [doctors, setDoctors] = useState(initial);
  const [bookings, setBookings] = useState<Booking[]>([]);

  async function loadBookings() {
    try {
      setBookings(await api('/provider/doctors/bookings'));
    } catch {
      /* leave empty — not critical if this fails to load */
    }
  }
  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-text">Your doctor listings</h2>
      {doctors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-text-secondary">
            You&rsquo;re not listed as a doctor in any community yet — request to join one above.
          </CardContent>
        </Card>
      ) : (
        doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            onSaved={(updated) => setDoctors((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)))}
          />
        ))
      )}

      {bookings.length > 0 && (
        <>
          <h2 className="mt-4 text-lg font-bold text-text">Appointments</h2>
          <div className="flex flex-col gap-3">
            {bookings.map((b) => (
              <BookingRow key={b.id} booking={b} onChanged={loadBookings} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DoctorCard({ doctor, onSaved }: { doctor: Doctor; onSaved: (updated: Doctor) => void }) {
  const [form, setForm] = useState({
    clinicName: doctor.clinicName ?? '',
    specialty: doctor.specialty,
    qualifications: doctor.qualifications ?? '',
    background: doctor.background ?? '',
    locality: doctor.locality ?? '',
    mapsLink: doctor.mapsLink ?? '',
    phone: doctor.phone,
    consultationFee: doctor.consultationFee,
  });
  const [isActive, setIsActive] = useState(doctor.isActive);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [photoPath, setPhotoPath] = useState(doctor.photoPath);

  const [slots, setSlots] = useState(doctor.slots);
  const [slotDateTime, setSlotDateTime] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await api(`/provider/doctors/${doctor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clinicName: form.clinicName.trim() || null,
          specialty: form.specialty.trim(),
          qualifications: form.qualifications.trim() || null,
          background: form.background.trim() || null,
          locality: form.locality.trim() || null,
          mapsLink: form.mapsLink.trim() || null,
          phone: form.phone.trim(),
          consultationFee: Number(form.consultationFee),
          isActive,
        }),
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/provider/doctors/${doctor.id}/photo`, { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not upload photo.');
      setPhotoPath(json.data.photoPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function addSlot() {
    if (!slotDateTime) return;
    setAddingSlot(true);
    try {
      const slot = await api(`/provider/doctors/${doctor.id}/slots`, {
        method: 'POST',
        body: JSON.stringify({ startsAt: new Date(slotDateTime).toISOString() }),
      });
      setSlots((prev) => [...prev, slot].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
      setSlotDateTime('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add slot.');
    } finally {
      setAddingSlot(false);
    }
  }

  async function removeSlot(slotId: string) {
    try {
      await api(`/provider/doctors/${doctor.id}/slots/${slotId}`, { method: 'DELETE' });
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove slot.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary-600" />
          {doctor.name} — {doctor.neighborhood.name}
        </CardTitle>
        <CardDescription>Residents see this listing on their community&rsquo;s Local Doctors page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPath} alt={doctor.name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <Stethoscope className="h-6 w-6 text-primary-600" />
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadPhoto} />
            <Camera className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : photoPath ? 'Change photo' : 'Add photo'}
          </label>
        </div>

        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`specialty-${doctor.id}`}>Specialty</Label>
            <Input id={`specialty-${doctor.id}`} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`clinic-${doctor.id}`}>Clinic / hospital</Label>
            <Input id={`clinic-${doctor.id}`} value={form.clinicName} onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`phone-${doctor.id}`}>Phone</Label>
            <Input id={`phone-${doctor.id}`} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`fee-${doctor.id}`}>Consultation fee (₹)</Label>
            <Input id={`fee-${doctor.id}`} type="number" min="0" value={form.consultationFee} onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor={`qual-${doctor.id}`}>Qualifications</Label>
            <Input id={`qual-${doctor.id}`} value={form.qualifications} onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))} placeholder="MBBS, MD (Cardiology)" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor={`bg-${doctor.id}`}>Background</Label>
            <Input id={`bg-${doctor.id}`} value={form.background} onChange={(e) => setForm((f) => ({ ...f, background: e.target.value }))} placeholder="20 years' experience, ex-AIIMS" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`locality-${doctor.id}`}>Locality</Label>
            <Input id={`locality-${doctor.id}`} value={form.locality} onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`maps-${doctor.id}`}>Google Maps link</Label>
            <Input id={`maps-${doctor.id}`} value={form.mapsLink} onChange={(e) => setForm((f) => ({ ...f, mapsLink: e.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm text-text sm:col-span-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Visible in the community directory
          </label>

          {error && <p className="text-sm text-danger-600 sm:col-span-2">{error}</p>}

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            {saved && <Badge variant="success">Saved</Badge>}
            <span className="ml-auto flex items-center gap-1 text-sm text-text-secondary">
              <IndianRupee className="h-3.5 w-3.5" /> {form.consultationFee || '0'} consultation
            </span>
          </div>
        </form>

        <div className="border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <Clock className="h-4 w-4" /> Bookable slots
          </p>
          {slots.length === 0 ? (
            <p className="mt-1 text-sm text-text-secondary">No open slots yet — add one below.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-1 rounded-xl border border-border px-2 py-1">
                  <span className="text-xs font-semibold text-text">
                    {new Date(slot.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  {!slot.isBooked && (
                    <button onClick={() => removeSlot(slot.id)} aria-label="Remove slot" className="text-text-secondary hover:text-danger-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input type="datetime-local" value={slotDateTime} onChange={(e) => setSlotDateTime(e.target.value)} className="w-auto" />
            <Button size="sm" variant="outline" disabled={addingSlot || !slotDateTime} onClick={addSlot}>
              <Plus className="h-3.5 w-3.5" /> Add slot
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookingRow({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action: 'confirm' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      await api(`/provider/doctors/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update booking.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="flex items-center gap-1.5 font-bold text-text">
            <CalendarClock className="h-4 w-4 text-primary-600" />
            {booking.elderUser.name}{booking.elderUser.phone ? ` · ${booking.elderUser.phone}` : ''}
          </p>
          <p className="text-sm text-text-secondary">
            {new Date(booking.slot.startsAt).toLocaleString('en-IN')} · {booking.doctor.neighborhood.name}
          </p>
          <Badge variant={STATUS_VARIANT[booking.status]} className="mt-1">{booking.status.replace('_', ' ')}</Badge>
          {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
        </div>
        {booking.status === 'pending_confirmation' && (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => act('confirm')}>Confirm</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act('cancel')}>Cancel</Button>
          </div>
        )}
        {booking.status === 'confirmed' && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act('cancel')}>Cancel</Button>
        )}
      </CardContent>
    </Card>
  );
}
