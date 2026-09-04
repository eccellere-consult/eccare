'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Car, Phone, Plus, Trash2, IndianRupee, MessageCircle, ShieldCheck, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { buildWaLink as waLink } from '@/lib/whatsapp';

type VerificationStatus = 'pending' | 'verified' | 'rejected';
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
  provider: { verificationStatus: VerificationStatus } | null;
}
interface RateCard {
  perKmRate: string;
  perMinWaitRate: string;
}
interface Me {
  memberships: { role: string }[];
}

type TripType = 'drop' | 'wait_and_return';
const VERIFICATION_VARIANT: Record<VerificationStatus, 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  verified: 'success',
  rejected: 'danger',
};

function AutoBookingContent() {
  const searchParams = useSearchParams();
  const prefillPickup = searchParams.get('pickup') ?? '';
  const prefillDrop = searchParams.get('drop') ?? '';
  const prefillDate = searchParams.get('date');
  const prefillTime = searchParams.get('time');

  const { data: drivers, loading, error, reload } = useCommunityData<Driver[]>('/community/auto-drivers');
  const { data: rateCard, reload: reloadRateCard } = useCommunityData<RateCard | null>('/community/auto-rate-card');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';

  const [bookingDriverId, setBookingDriverId] = useState<string | null>(null);
  const [tripType, setTripType] = useState<TripType>('drop');
  const [pickup, setPickup] = useState(prefillPickup);
  const [drop, setDrop] = useState(prefillDrop);

  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', whatsapp: '', vehicleNumber: '', serviceArea: '', perKmRate: '', perMinWaitRate: '' });
  const [driverBusy, setDriverBusy] = useState(false);
  const [driverError, setDriverError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ perKmRate: '', perMinWaitRate: '' });
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState('');

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    setDriverBusy(true);
    setDriverError('');
    try {
      await communityApi.post('/community/auto-drivers', {
        name: driverForm.name.trim(),
        phone: driverForm.phone.trim(),
        whatsapp: driverForm.whatsapp.trim() || undefined,
        vehicleNumber: driverForm.vehicleNumber.trim() || undefined,
        serviceArea: driverForm.serviceArea.trim() || undefined,
        perKmRate: driverForm.perKmRate ? Number(driverForm.perKmRate) : undefined,
        perMinWaitRate: driverForm.perMinWaitRate ? Number(driverForm.perMinWaitRate) : undefined,
      });
      setDriverForm({ name: '', phone: '', whatsapp: '', vehicleNumber: '', serviceArea: '', perKmRate: '', perMinWaitRate: '' });
      setShowAddDriver(false);
      reload();
    } catch (err) {
      setDriverError(err instanceof Error ? err.message : 'Could not add driver.');
    } finally {
      setDriverBusy(false);
    }
  }

  async function removeDriver(id: string) {
    if (!confirm('Remove this driver from the list?')) return;
    setRemovingId(id);
    try {
      await communityApi.delete(`/community/auto-drivers/${id}`);
      reload();
    } finally {
      setRemovingId(null);
    }
  }

  async function toggleAvailable(driver: Driver) {
    setTogglingId(driver.id);
    try {
      await communityApi.patch(`/community/auto-drivers/${driver.id}`, { isAvailable: !driver.isAvailable });
      reload();
    } finally {
      setTogglingId(null);
    }
  }

  async function saveRateCard(e: React.FormEvent) {
    e.preventDefault();
    setRateBusy(true);
    setRateError('');
    try {
      await communityApi.put('/community/auto-rate-card', {
        perKmRate: Number(rateForm.perKmRate),
        perMinWaitRate: Number(rateForm.perMinWaitRate),
      });
      setShowRateForm(false);
      reloadRateCard();
    } catch (err) {
      setRateError(err instanceof Error ? err.message : 'Could not save rates.');
    } finally {
      setRateBusy(false);
    }
  }

  function effectiveRate(driver: Driver): { perKm: string; perMinWait: string } | null {
    const perKm = driver.perKmRate ?? rateCard?.perKmRate;
    const perMinWait = driver.perMinWaitRate ?? rateCard?.perMinWaitRate;
    if (!perKm || !perMinWait) return null;
    return { perKm, perMinWait };
  }

  function bookMessage(driver: Driver): string {
    const tripLabel = tripType === 'drop' ? 'Drop only' : 'Go there & come back';
    const rate = effectiveRate(driver);
    return [
      'Hello, I need to book your auto through EC.',
      `Trip: ${tripLabel}`,
      `Pickup: ${pickup || '(please confirm)'}`,
      `Drop: ${drop || '(please confirm)'}`,
      prefillDate ? `Date: ${prefillDate}${prefillTime ? ` at ${prefillTime}` : ''}` : '',
      rate ? `Indicative rate: ₹${rate.perKm}/km, ₹${rate.perMinWait}/min waiting.` : '',
      'Please reply to confirm you can take this trip. Thank you!',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const visibleDrivers = drivers?.filter((d) => canManage || d.isAvailable);

  return (
    <CommunityPageFrame
      title="Auto Booking"
      subtitle="Book a trusted local auto-rickshaw for an elder — drop-off, or go there and come back."
      loading={loading}
      error={error}
    >
      {(prefillPickup || prefillDrop) && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-text">Trip details filled in from your appointment — edit if needed.</p>
          </CardContent>
        </Card>
      )}

      {rateCard ? (
        <Card className="mt-3 border-accent-100 bg-accent-50">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
              <IndianRupee className="h-5 w-5 text-accent-600" />
            </span>
            <p className="text-sm text-text">
              <span className="font-bold">₹{rateCard.perKmRate}/km</span> · <span className="font-bold">₹{rateCard.perMinWaitRate}/min</span> waiting
              — default rate when a driver hasn't set their own. Agree the exact fare with the driver before the trip.
            </p>
            {canManage && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setRateForm({ perKmRate: rateCard.perKmRate, perMinWaitRate: rateCard.perMinWaitRate }); setShowRateForm(true); }}>
                Edit default rate
              </Button>
            )}
          </CardContent>
        </Card>
      ) : canManage ? (
        <Card className="mt-3">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <p className="text-sm text-text-secondary">No default rate set yet.</p>
            <Button size="sm" onClick={() => { setRateForm({ perKmRate: '', perMinWaitRate: '' }); setShowRateForm(true); }}>Set default rate</Button>
          </CardContent>
        </Card>
      ) : null}

      {showRateForm && (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <form onSubmit={saveRateCard} className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="perkm">Rate per km (₹)</Label>
                <Input id="perkm" type="number" step="0.5" min="0" value={rateForm.perKmRate} onChange={(e) => setRateForm((f) => ({ ...f, perKmRate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="permin">Waiting rate per min (₹)</Label>
                <Input id="permin" type="number" step="0.5" min="0" value={rateForm.perMinWaitRate} onChange={(e) => setRateForm((f) => ({ ...f, perMinWaitRate: e.target.value }))} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm" disabled={rateBusy}>{rateBusy ? 'Saving…' : 'Save'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowRateForm(false)}>Cancel</Button>
              </div>
              {rateError && <p className="col-span-full text-sm text-danger-600">{rateError}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => setShowAddDriver((s) => !s)}>
            <Plus className="h-4 w-4" />
            {showAddDriver ? 'Cancel' : 'Add driver'}
          </Button>
          {showAddDriver && (
            <Card className="mt-2">
              <CardContent className="pt-6">
                <form onSubmit={addDriver} className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-name">Driver name</Label>
                    <Input id="d-name" value={driverForm.name} onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-phone">Phone</Label>
                    <Input id="d-phone" value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-whatsapp">WhatsApp (optional, if different)</Label>
                    <Input id="d-whatsapp" value={driverForm.whatsapp} onChange={(e) => setDriverForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="9876543210" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-vehicle">Vehicle number (optional)</Label>
                    <Input id="d-vehicle" value={driverForm.vehicleNumber} onChange={(e) => setDriverForm((f) => ({ ...f, vehicleNumber: e.target.value }))} placeholder="KL-01-AB-1234" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-area">Service area (optional)</Label>
                    <Input id="d-area" value={driverForm.serviceArea} onChange={(e) => setDriverForm((f) => ({ ...f, serviceArea: e.target.value }))} placeholder="Near the main gate" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-perkm">Rate per km (₹, optional)</Label>
                    <Input id="d-perkm" type="number" step="0.5" min="0" value={driverForm.perKmRate} onChange={(e) => setDriverForm((f) => ({ ...f, perKmRate: e.target.value }))} placeholder="Uses default if blank" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="d-permin">Waiting rate per min (₹, optional)</Label>
                    <Input id="d-permin" type="number" step="0.5" min="0" value={driverForm.perMinWaitRate} onChange={(e) => setDriverForm((f) => ({ ...f, perMinWaitRate: e.target.value }))} placeholder="Uses default if blank" />
                  </div>
                  {driverError && <p className="col-span-full text-sm text-danger-600">{driverError}</p>}
                  <Button type="submit" size="sm" disabled={driverBusy || !driverForm.name.trim() || !driverForm.phone.trim()} className="w-fit">
                    {driverBusy ? 'Adding…' : 'Add'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleDrivers?.map((driver) => {
          const rate = effectiveRate(driver);
          const verification = driver.provider?.verificationStatus ?? null;
          return (
            <Card key={driver.id} className={!driver.isAvailable ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Car className="h-5 w-5 text-primary-600" />
                    </span>
                    <div>
                      <p className="font-bold text-text">{driver.name}</p>
                      {driver.vehicleNumber && <p className="text-xs text-text-secondary">{driver.vehicleNumber}</p>}
                      {driver.serviceArea && <p className="text-xs text-text-secondary">{driver.serviceArea}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {verification && (
                      <Badge variant={VERIFICATION_VARIANT[verification]}>
                        <ShieldCheck className="mr-1 h-3 w-3" />{verification}
                      </Badge>
                    )}
                    {!driver.isAvailable && canManage && (
                      <Badge variant="muted"><EyeOff className="mr-1 h-3 w-3" />unavailable</Badge>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        disabled={removingId === driver.id}
                        onClick={() => removeDriver(driver.id)}
                        aria-label={`Remove ${driver.name}`}
                        className="text-text-secondary hover:text-danger-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {rate && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary-900">
                    <IndianRupee className="h-3.5 w-3.5" /> ₹{rate.perKm}/km · ₹{rate.perMinWait}/min waiting
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`tel:${driver.phone}`} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                  <Button size="sm" onClick={() => setBookingDriverId(bookingDriverId === driver.id ? null : driver.id)}>
                    {bookingDriverId === driver.id ? 'Cancel' : 'Book'}
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="outline" disabled={togglingId === driver.id} onClick={() => toggleAvailable(driver)}>
                      {driver.isAvailable ? 'Mark unavailable' : 'Mark available'}
                    </Button>
                  )}
                </div>

                {bookingDriverId === driver.id && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTripType('drop')}
                        className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${tripType === 'drop' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                      >
                        Drop only
                      </button>
                      <button
                        type="button"
                        onClick={() => setTripType('wait_and_return')}
                        className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${tripType === 'wait_and_return' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                      >
                        Go there &amp; come back
                      </button>
                    </div>
                    <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location" />
                    <Input value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="Drop location" />
                    <a
                      href={waLink(driver.whatsapp || driver.phone, bookMessage(driver))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-success-600 px-4 py-2 text-sm font-bold text-white hover:bg-success-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Send booking request on WhatsApp
                    </a>
                    <p className="text-xs text-text-secondary">
                      Opens WhatsApp with your trip details filled in — the driver will reply to confirm.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && (!visibleDrivers || visibleDrivers.length === 0) && (
        <Card className="mt-4">
          <CardContent className="py-12 text-center text-text-secondary">
            No drivers listed yet.{canManage ? ' Add one above.' : ''}
          </CardContent>
        </Card>
      )}
    </CommunityPageFrame>
  );
}

export default function AutoBookingPage() {
  return (
    <Suspense fallback={null}>
      <AutoBookingContent />
    </Suspense>
  );
}
