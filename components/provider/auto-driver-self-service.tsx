'use client';

import { useEffect, useState } from 'react';
import { Car, IndianRupee, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Driver {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  vehicleNumber: string | null;
  serviceArea: string | null;
  perKmRate: string | null;
  perMinWaitRate: string | null;
  isAvailable: boolean;
  neighborhood: { id: string; name: string };
}
interface Booking {
  id: string;
  status: 'pending_confirmation' | 'confirmed' | 'paid' | 'closed' | 'cancelled';
  fareAmount: string;
  pickupAddress: string;
  dropAddress: string;
  driver: { name: string; neighborhood: { name: string } };
  elderUser: { name: string; phone: string | null };
}

const BOOKING_STATUS_VARIANT: Record<Booking['status'], 'accent' | 'success' | 'danger' | 'muted'> = {
  pending_confirmation: 'accent',
  confirmed: 'accent',
  paid: 'success',
  closed: 'success',
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

/** Self-service editing of the provider's own AutoDriver row(s) — one per
 *  community they've been approved to join. Only shown when the provider's
 *  own category is auto_transport (see app/provider/page.tsx). */
export function AutoDriverSelfService({ initial }: { initial: Driver[] }) {
  const [drivers, setDrivers] = useState(initial);
  const [bookings, setBookings] = useState<Booking[]>([]);

  async function loadBookings() {
    try {
      setBookings(await api('/provider/auto-bookings'));
    } catch {
      /* leave empty — not critical if this fails to load */
    }
  }
  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-text">Your transport listings</h2>
      {drivers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-text-secondary">
            You&rsquo;re not listed as a driver in any community yet — request to join one above.
          </CardContent>
        </Card>
      ) : (
        drivers.map((driver) => (
          <DriverCard
            key={driver.id}
            driver={driver}
            onSaved={(updated) => setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))}
          />
        ))
      )}

      {bookings.length > 0 && (
        <>
          <h2 className="mt-4 text-lg font-bold text-text">Bookings</h2>
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

function BookingRow({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action: 'confirm' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      await api(`/provider/auto-bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
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
            <Car className="h-4 w-4 text-primary-600" />
            {booking.elderUser.name}{booking.elderUser.phone ? ` · ${booking.elderUser.phone}` : ''}
          </p>
          <p className="text-sm text-text-secondary">
            {booking.pickupAddress} → {booking.dropAddress} · {booking.driver.neighborhood.name}
          </p>
          <p className="text-sm text-text-secondary">₹{booking.fareAmount}</p>
          <Badge variant={BOOKING_STATUS_VARIANT[booking.status]} className="mt-1">{booking.status.replace('_', ' ')}</Badge>
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

function DriverCard({ driver, onSaved }: { driver: Driver; onSaved: (updated: Driver) => void }) {
  const [form, setForm] = useState({
    phone: driver.phone,
    whatsapp: driver.whatsapp ?? '',
    vehicleNumber: driver.vehicleNumber ?? '',
    serviceArea: driver.serviceArea ?? '',
    perKmRate: driver.perKmRate ?? '',
    perMinWaitRate: driver.perMinWaitRate ?? '',
  });
  const [isAvailable, setIsAvailable] = useState(driver.isAvailable);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await api(`/provider/auto-drivers/${driver.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: form.phone.trim(),
          whatsapp: form.whatsapp.trim() || null,
          vehicleNumber: form.vehicleNumber.trim() || null,
          serviceArea: form.serviceArea.trim() || null,
          perKmRate: form.perKmRate ? Number(form.perKmRate) : null,
          perMinWaitRate: form.perMinWaitRate ? Number(form.perMinWaitRate) : null,
          isAvailable,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary-600" />
          {driver.name} — {driver.neighborhood.name}
        </CardTitle>
        <CardDescription>Residents see this listing on their community&rsquo;s Auto Booking page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`phone-${driver.id}`}>Phone</Label>
            <Input id={`phone-${driver.id}`} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`whatsapp-${driver.id}`}>WhatsApp (if different)</Label>
            <Input id={`whatsapp-${driver.id}`} value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`vehicle-${driver.id}`}>Vehicle number</Label>
            <Input id={`vehicle-${driver.id}`} value={form.vehicleNumber} onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))} placeholder="KL-01-AB-1234" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`area-${driver.id}`}>Service area</Label>
            <Input id={`area-${driver.id}`} value={form.serviceArea} onChange={(e) => setForm((f) => ({ ...f, serviceArea: e.target.value }))} placeholder="Near the main gate" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`perkm-${driver.id}`}>Rate per km (₹)</Label>
            <Input id={`perkm-${driver.id}`} type="number" step="0.5" min="0" value={form.perKmRate} onChange={(e) => setForm((f) => ({ ...f, perKmRate: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`permin-${driver.id}`}>Waiting rate per min (₹)</Label>
            <Input id={`permin-${driver.id}`} type="number" step="0.5" min="0" value={form.perMinWaitRate} onChange={(e) => setForm((f) => ({ ...f, perMinWaitRate: e.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm text-text sm:col-span-2">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Available for bookings right now
          </label>

          {error && <p className="text-sm text-danger-600 sm:col-span-2">{error}</p>}

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
            </Button>
            {saved && <Badge variant="success">Saved</Badge>}
            {(form.perKmRate || form.perMinWaitRate) && (
              <span className="ml-auto flex items-center gap-1 text-sm text-text-secondary">
                <IndianRupee className="h-3.5 w-3.5" /> {form.perKmRate || '—'}/km · {form.perMinWaitRate || '—'}/min
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
