'use client';

import { useState, useCallback } from 'react';
import { Stethoscope, Phone, MapPin, Plus, Trash2, Clock, IndianRupee, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Slot {
  id: string;
  startsAt: string;
  isBooked: boolean;
}
interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualifications: string | null;
  background: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  mapsLink: string | null;
  phone: string;
  consultationFee: string;
  slots: Slot[];
}
interface Booking {
  id: string;
  status: 'pending_confirmation' | 'confirmed' | 'paid' | 'cancelled';
  amount: string;
  razorpayOrderId: string | null;
  doctor: { name: string; specialty: string; phone: string };
  slot: { startsAt: string };
}
interface Me {
  memberships: { role: string }[];
  name?: string;
  phone?: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_confirmation: 'Waiting for clinic to confirm',
  confirmed: 'Confirmed — payment due',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
const STATUS_VARIANT: Record<Booking['status'], 'accent' | 'success' | 'danger' | 'muted'> = {
  pending_confirmation: 'accent',
  confirmed: 'accent',
  paid: 'success',
  cancelled: 'muted',
};

const EMPTY_DOCTOR_FORM = {
  name: '', specialty: '', qualifications: '', background: '', locality: '', mapsLink: '', phone: '', consultationFee: '',
};

export default function DoctorsPage() {
  const [tab, setTab] = useState<'directory' | 'bookings'>('directory');
  const { data: doctors, loading, error, reload } = useCommunityData<Doctor[]>('/community/doctors');
  const { data: bookings, reload: reloadBookings } = useCommunityData<Booking[]>('/community/doctor-bookings');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';

  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR_FORM);
  const [geoStatus, setGeoStatus] = useState<{ lat: number; lng: number } | null>(null);
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [doctorError, setDoctorError] = useState('');

  const [slotDoctorId, setSlotDoctorId] = useState<string | null>(null);
  const [slotDateTime, setSlotDateTime] = useState('');
  const [slotBusy, setSlotBusy] = useState(false);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoStatus({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setActionError('Could not get your location. You can use a Google Maps link instead.'),
    );
  }

  async function addDoctor(e: React.FormEvent) {
    e.preventDefault();
    setDoctorBusy(true);
    setDoctorError('');
    try {
      await communityApi.post('/community/doctors', {
        name: doctorForm.name.trim(),
        specialty: doctorForm.specialty.trim(),
        qualifications: doctorForm.qualifications.trim() || undefined,
        background: doctorForm.background.trim() || undefined,
        locality: doctorForm.locality.trim() || undefined,
        mapsLink: doctorForm.mapsLink.trim() || undefined,
        lat: geoStatus?.lat,
        lng: geoStatus?.lng,
        phone: doctorForm.phone.trim(),
        consultationFee: Number(doctorForm.consultationFee),
      });
      setDoctorForm(EMPTY_DOCTOR_FORM);
      setGeoStatus(null);
      setShowAddDoctor(false);
      reload();
    } catch (err) {
      setDoctorError(err instanceof Error ? err.message : 'Could not add doctor.');
    } finally {
      setDoctorBusy(false);
    }
  }

  async function removeDoctor(id: string) {
    if (!confirm('Remove this doctor from the directory?')) return;
    try {
      await communityApi.delete(`/community/doctors/${id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove doctor.');
    }
  }

  async function addSlot(doctorId: string) {
    if (!slotDateTime) return;
    setSlotBusy(true);
    try {
      await communityApi.post(`/community/doctors/${doctorId}/slots`, { startsAt: new Date(slotDateTime).toISOString() });
      setSlotDateTime('');
      setSlotDoctorId(null);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add slot.');
    } finally {
      setSlotBusy(false);
    }
  }

  async function removeSlot(doctorId: string, slotId: string) {
    try {
      await communityApi.delete(`/community/doctors/${doctorId}/slots/${slotId}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove slot.');
    }
  }

  async function book(doctor: Doctor, slot: Slot) {
    setBookingId(slot.id);
    setActionError('');
    try {
      await communityApi.post('/community/doctor-bookings', { slotId: slot.id });
      // Notify the clinic — same wa.me handoff as Auto Booking, since the clinic
      // has no login to receive an in-app request.
      const message = [
        'Hello, I would like to confirm an appointment booked through EC.',
        `Patient: ${me?.name ?? ''}`,
        `Requested time: ${new Date(slot.startsAt).toLocaleString('en-IN')}`,
        `Consultation fee: ₹${doctor.consultationFee}`,
        'Please call or reply to confirm this slot. Thank you!',
      ].join('\n');
      window.open(`https://wa.me/${doctor.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
      reload();
      reloadBookings();
      setTab('bookings');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not book this slot.');
    } finally {
      setBookingId(null);
    }
  }

  async function confirmBooking(id: string) {
    try {
      await communityApi.patch(`/community/doctor-bookings/${id}`, { action: 'confirm' });
      reloadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update booking.');
    }
  }

  async function cancelBooking(id: string) {
    if (!confirm('Cancel this booking?')) return;
    try {
      await communityApi.patch(`/community/doctor-bookings/${id}`, { action: 'cancel' });
      reloadBookings();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel booking.');
    }
  }

  const pay = useCallback(async (booking: Booking) => {
    setPayingId(booking.id);
    setActionError('');
    try {
      const payRes = await fetch(`/api/v1/community/doctor-bookings/${booking.id}/pay`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
      if (!payRes.success) throw new Error(payRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = payRes.data;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: `Consultation — ${booking.doctor.name}`,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/community/doctor-bookings/${booking.id}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());
          if (!verifyRes.success) setActionError(verifyRes.error?.message || 'Payment could not be verified.');
          reloadBookings();
          setPayingId(null);
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      razorpay.open();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start payment.');
      setPayingId(null);
    }
  }, [reloadBookings]);

  return (
    <CommunityPageFrame title="Local Doctors" subtitle="Find a nearby doctor and book a time slot." loading={loading} error={error}>
      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'directory' ? 'primary' : 'outline'} onClick={() => setTab('directory')}>Directory</Button>
        <Button size="sm" variant={tab === 'bookings' ? 'primary' : 'outline'} onClick={() => setTab('bookings')}>My Bookings</Button>
      </div>
      {actionError && <p className="mt-3 text-sm text-danger-600">{actionError}</p>}

      {tab === 'directory' && (
        <>
          {canManage && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => setShowAddDoctor((s) => !s)}>
                <Plus className="h-4 w-4" /> {showAddDoctor ? 'Cancel' : 'Add doctor'}
              </Button>
              {showAddDoctor && (
                <Card className="mt-2">
                  <CardContent className="pt-6">
                    <form onSubmit={addDoctor} className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-name">Name</Label>
                        <Input id="doc-name" value={doctorForm.name} onChange={(e) => setDoctorForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-spec">Specialty</Label>
                        <Input id="doc-spec" value={doctorForm.specialty} onChange={(e) => setDoctorForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="Cardiologist" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-phone">Phone</Label>
                        <Input id="doc-phone" value={doctorForm.phone} onChange={(e) => setDoctorForm((f) => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-fee">Consultation fee (₹)</Label>
                        <Input id="doc-fee" type="number" min="0" value={doctorForm.consultationFee} onChange={(e) => setDoctorForm((f) => ({ ...f, consultationFee: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <Label htmlFor="doc-qual">Qualifications (optional)</Label>
                        <Input id="doc-qual" value={doctorForm.qualifications} onChange={(e) => setDoctorForm((f) => ({ ...f, qualifications: e.target.value }))} placeholder="MBBS, MD (Cardiology)" />
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <Label htmlFor="doc-bg">Background (optional)</Label>
                        <Input id="doc-bg" value={doctorForm.background} onChange={(e) => setDoctorForm((f) => ({ ...f, background: e.target.value }))} placeholder="20 years' experience, ex-AIIMS" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-locality">Locality (optional)</Label>
                        <Input id="doc-locality" value={doctorForm.locality} onChange={(e) => setDoctorForm((f) => ({ ...f, locality: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="doc-maps">Google Maps link (optional)</Label>
                        <Input id="doc-maps" value={doctorForm.mapsLink} onChange={(e) => setDoctorForm((f) => ({ ...f, mapsLink: e.target.value }))} placeholder="https://maps.google.com/..." />
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>
                          <MapPin className="h-3.5 w-3.5" /> Use my current location instead
                        </Button>
                        {geoStatus && <span className="text-xs text-success-600">Location captured ✓</span>}
                      </div>
                      {doctorError && <p className="text-sm text-danger-600 sm:col-span-2">{doctorError}</p>}
                      <Button type="submit" size="sm" disabled={doctorBusy || !doctorForm.name.trim() || !doctorForm.specialty.trim() || !doctorForm.phone.trim()} className="w-fit">
                        {doctorBusy ? 'Adding…' : 'Add doctor'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {doctors?.map((doctor) => (
              <Card key={doctor.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <Stethoscope className="h-5 w-5 text-primary-600" />
                      </span>
                      <div>
                        <p className="font-bold text-text">{doctor.name}</p>
                        <p className="text-xs text-text-secondary">{doctor.specialty}</p>
                      </div>
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => removeDoctor(doctor.id)} aria-label={`Remove ${doctor.name}`} className="text-text-secondary hover:text-danger-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {doctor.qualifications && <p className="mt-2 text-sm text-text-secondary">{doctor.qualifications}</p>}
                  {doctor.background && <p className="mt-1 text-sm text-text-secondary">{doctor.background}</p>}
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                    <IndianRupee className="h-3.5 w-3.5" /> ₹{doctor.consultationFee} consultation
                  </p>
                  {(doctor.locality || doctor.mapsLink) && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {doctor.locality}
                      {doctor.mapsLink && (
                        <a href={doctor.mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                          Map <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <a href={`tel:${doctor.phone}`} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  </div>

                  <div className="mt-3 border-t border-border pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-text-secondary">
                      <Clock className="h-3.5 w-3.5" /> Available slots
                    </p>
                    {doctor.slots.length === 0 ? (
                      <p className="mt-1 text-sm text-text-secondary">No open slots right now.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {doctor.slots.map((slot) => (
                          <div key={slot.id} className="flex items-center gap-1 rounded-xl border border-border px-2 py-1">
                            <button
                              type="button"
                              disabled={bookingId === slot.id}
                              onClick={() => book(doctor, slot)}
                              className="text-xs font-semibold text-primary-600 hover:underline disabled:opacity-50"
                            >
                              {new Date(slot.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                            </button>
                            {canManage && (
                              <button type="button" onClick={() => removeSlot(doctor.id, slot.id)} aria-label="Remove slot" className="text-text-secondary hover:text-danger-600">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canManage && (
                      <div className="mt-2">
                        {slotDoctorId === doctor.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input type="datetime-local" value={slotDateTime} onChange={(e) => setSlotDateTime(e.target.value)} className="w-auto" />
                            <Button size="sm" disabled={slotBusy || !slotDateTime} onClick={() => addSlot(doctor.id)}>Add</Button>
                            <Button size="sm" variant="outline" onClick={() => setSlotDoctorId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setSlotDoctorId(doctor.id)}>
                            <Plus className="h-3.5 w-3.5" /> Add slot
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!loading && (!doctors || doctors.length === 0) && (
            <Card className="mt-4"><CardContent className="py-12 text-center text-text-secondary">No doctors listed yet.{canManage ? ' Add one above.' : ''}</CardContent></Card>
          )}
        </>
      )}

      {tab === 'bookings' && (
        <div className="mt-4 flex flex-col gap-3">
          {(!bookings || bookings.length === 0) ? (
            <Card><CardContent className="py-12 text-center text-text-secondary">No bookings yet.</CardContent></Card>
          ) : (
            bookings.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-bold text-text">{b.doctor.name} — {b.doctor.specialty}</p>
                    <p className="text-sm text-text-secondary">{new Date(b.slot.startsAt).toLocaleString('en-IN')}</p>
                    <p className="text-sm text-text-secondary">₹{b.amount}</p>
                    <Badge variant={STATUS_VARIANT[b.status]} className="mt-1">{STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {b.status === 'pending_confirmation' && (
                      <>
                        <Button size="sm" onClick={() => confirmBooking(b.id)}>Clinic confirmed — mark confirmed</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelBooking(b.id)}>Cancel</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <>
                        <Button size="sm" disabled={payingId === b.id} onClick={() => pay(b)}>{payingId === b.id ? 'Opening…' : `Pay ₹${b.amount}`}</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelBooking(b.id)}>Cancel</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </CommunityPageFrame>
  );
}
