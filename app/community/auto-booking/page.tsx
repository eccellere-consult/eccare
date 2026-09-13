'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Car, Phone, Plus, Trash2, IndianRupee, MessageCircle, ShieldCheck, EyeOff, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { buildWaLink as waLink } from '@/lib/whatsapp';
import { renderTemplate, getTemplateDef } from '@/lib/whatsapp-templates-shared';
import { RatingInput } from '@/components/rating-input';
import { ProviderRatingSummaryDisplay } from '@/components/provider-rating-summary';

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
interface Booking {
  id: string;
  status: 'pending_confirmation' | 'confirmed' | 'paid' | 'closed' | 'cancelled';
  fareAmount: string;
  pickupAddress: string;
  pickupLat: string | null;
  pickupLng: string | null;
  dropAddress: string;
  dropLat: string | null;
  dropLng: string | null;
  createdAt: string;
  driver: { name: string; phone: string; vehicleNumber: string | null };
  rating: { stars: number; comment: string | null } | null;
}

/** Same "share current location" pattern used for doctor/provider
 *  registration (navigator.geolocation, no maps/geocoding dependency) —
 *  here tagging pickup and drop points on a Google Maps link, like Uber. */
function mapsLinkFor(lat: string | null, lng: string | null): string | null {
  if (!lat || !lng) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
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

const BOOKING_STATUS_LABEL: Record<Booking['status'], string> = {
  pending_confirmation: 'Waiting for driver to confirm',
  confirmed: 'Confirmed — payment due',
  paid: 'Paid',
  closed: 'Ride confirmed',
  cancelled: 'Cancelled',
};
const BOOKING_STATUS_VARIANT: Record<Booking['status'], 'accent' | 'success' | 'danger' | 'muted'> = {
  pending_confirmation: 'accent',
  confirmed: 'accent',
  paid: 'success',
  closed: 'success',
  cancelled: 'muted',
};

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

  const [tab, setTab] = useState<'directory' | 'bookings'>('directory');
  const { data: drivers, loading, error, reload } = useCommunityData<Driver[]>('/community/auto-drivers');
  const { data: rateCard, reload: reloadRateCard } = useCommunityData<RateCard | null>('/community/auto-rate-card');
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data: bookings, reload: reloadBookings } = useCommunityData<Booking[]>('/community/auto-bookings');
  const { data: messageTemplates } = useCommunityData<Record<string, string>>('/whatsapp-templates');
  const canManage = me?.memberships?.[0]?.role !== 'member';

  const [bookingDriverId, setBookingDriverId] = useState<string | null>(null);
  const [tripType, setTripType] = useState<TripType>('drop');
  const [pickup, setPickup] = useState(prefillPickup);
  const [drop, setDrop] = useState(prefillDrop);
  const [pickupGeo, setPickupGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [dropGeo, setDropGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [fareAmount, setFareAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');

  function tagPickupLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPickupGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setRequestError('Could not get your location. You can still request the booking without it.'),
    );
  }
  function tagDropLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDropGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setRequestError('Could not get your location. You can still request the booking without it.'),
    );
  }

  const [payingId, setPayingId] = useState<string | null>(null);
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [bookingActionError, setBookingActionError] = useState('');

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
    const body = messageTemplates?.auto_booking_request ?? getTemplateDef('auto_booking_request').defaultBody;
    return renderTemplate(body, {
      trip: tripLabel,
      pickup: pickup || '(please confirm)',
      drop: drop || '(please confirm)',
      date_line: prefillDate ? `Date: ${prefillDate}${prefillTime ? ` at ${prefillTime}` : ''}` : '',
      rate_line: rate ? `Indicative rate: ₹${rate.perKm}/km, ₹${rate.perMinWait}/min waiting.` : '',
    })
      .split('\n')
      .filter((line) => line.trim())
      .join('\n');
  }

  async function requestBooking(driver: Driver) {
    setRequesting(true);
    setRequestError('');
    try {
      await communityApi.post('/community/auto-bookings', {
        driverId: driver.id,
        pickupAddress: pickup.trim(),
        pickupLat: pickupGeo?.lat,
        pickupLng: pickupGeo?.lng,
        dropAddress: drop.trim(),
        dropLat: dropGeo?.lat,
        dropLng: dropGeo?.lng,
        fareAmount: Number(fareAmount),
      });
      setBookingDriverId(null);
      setFareAmount('');
      setPickupGeo(null);
      setDropGeo(null);
      reloadBookings();
      setTab('bookings');
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not request this booking.');
    } finally {
      setRequesting(false);
    }
  }

  async function confirmBooking(id: string) {
    setBookingActionError('');
    try {
      await communityApi.patch(`/community/auto-bookings/${id}`, { action: 'confirm' });
      reloadBookings();
    } catch (err) {
      setBookingActionError(err instanceof Error ? err.message : 'Could not update booking.');
    }
  }

  async function cancelBooking(id: string) {
    if (!confirm('Cancel this booking?')) return;
    setBookingActionError('');
    try {
      await communityApi.patch(`/community/auto-bookings/${id}`, { action: 'cancel' });
      reloadBookings();
    } catch (err) {
      setBookingActionError(err instanceof Error ? err.message : 'Could not cancel booking.');
    }
  }

  const payBooking = useCallback(async (booking: Booking) => {
    setPayingId(booking.id);
    setBookingActionError('');
    try {
      const payRes = await fetch(`/api/v1/community/auto-bookings/${booking.id}/pay`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
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
        description: `Auto ride — ${booking.driver.name}`,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/community/auto-bookings/${booking.id}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());
          if (!verifyRes.success) setBookingActionError(verifyRes.error?.message || 'Payment could not be verified.');
          reloadBookings();
          setPayingId(null);
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      razorpay.open();
    } catch (err) {
      setBookingActionError(err instanceof Error ? err.message : 'Could not start payment.');
      setPayingId(null);
    }
  }, [reloadBookings]);

  async function closeBooking(id: string, stars: number, comment: string) {
    setClosingId(id);
    setBookingActionError('');
    try {
      const res = await fetch(`/api/v1/community/auto-bookings/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not confirm the ride.');
      setRatingBookingId(null);
      reloadBookings();
    } catch (err) {
      setBookingActionError(err instanceof Error ? err.message : 'Could not confirm the ride.');
    } finally {
      setClosingId(null);
    }
  }

  const visibleDrivers = drivers?.filter((d) => canManage || d.isAvailable);

  return (
    <CommunityPageFrame
      title="Auto Booking"
      subtitle="Book a trusted local auto-rickshaw for an elder — drop-off, or go there and come back."
      loading={loading}
      error={error}
    >
      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'directory' ? 'primary' : 'outline'} onClick={() => setTab('directory')}>Directory</Button>
        <Button size="sm" variant={tab === 'bookings' ? 'primary' : 'outline'} onClick={() => setTab('bookings')}>My Bookings</Button>
      </div>
      {bookingActionError && <p className="mt-3 text-sm text-danger-600">{bookingActionError}</p>}

      {tab === 'directory' && (
      <>
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
                    <div className="flex gap-2">
                      <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location" />
                      <Button type="button" size="sm" variant="outline" onClick={tagPickupLocation}>
                        <MapPin className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {pickupGeo && <span className="text-xs text-success-600">Pickup point tagged on map ✓</span>}
                    <div className="flex gap-2">
                      <Input value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="Drop location" />
                      <Button type="button" size="sm" variant="outline" onClick={tagDropLocation}>
                        <MapPin className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {dropGeo && <span className="text-xs text-success-600">Drop point tagged on map ✓</span>}
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

                    <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                      <Label htmlFor={`fare-${driver.id}`}>Agreed fare (₹)</Label>
                      <Input
                        id={`fare-${driver.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={fareAmount}
                        onChange={(e) => setFareAmount(e.target.value)}
                        placeholder="Agree this with the driver first"
                      />
                      <Button
                        size="sm"
                        disabled={requesting || !pickup.trim() || !drop.trim() || !fareAmount}
                        onClick={() => requestBooking(driver)}
                      >
                        {requesting ? 'Requesting…' : 'Request booking in EC'}
                      </Button>
                      <p className="text-xs text-text-secondary">
                        Tracks this booking, payment, and confirmation right here — recommended once you and the driver have agreed a fare.
                      </p>
                      {requestError && <p className="text-sm text-danger-600">{requestError}</p>}
                    </div>
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
                    <p className="font-bold text-text">{b.driver.name}{b.driver.vehicleNumber ? ` · ${b.driver.vehicleNumber}` : ''}</p>
                    <p className="text-sm text-text-secondary">{b.pickupAddress} → {b.dropAddress}</p>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs">
                      {mapsLinkFor(b.pickupLat, b.pickupLng) && (
                        <a href={mapsLinkFor(b.pickupLat, b.pickupLng)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                          <MapPin className="h-3 w-3" /> Pickup on map <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {mapsLinkFor(b.dropLat, b.dropLng) && (
                        <a href={mapsLinkFor(b.dropLat, b.dropLng)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                          <MapPin className="h-3 w-3" /> Drop on map <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">₹{b.fareAmount}</p>
                    <Badge variant={BOOKING_STATUS_VARIANT[b.status]} className="mt-1">{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.status === 'pending_confirmation' && (
                      <>
                        <Button size="sm" onClick={() => confirmBooking(b.id)}>Driver confirmed — mark confirmed</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelBooking(b.id)}>Cancel</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <>
                        <Button size="sm" disabled={payingId === b.id} onClick={() => payBooking(b)}>{payingId === b.id ? 'Opening…' : `Pay ₹${b.fareAmount}`}</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelBooking(b.id)}>Cancel</Button>
                      </>
                    )}
                    {b.status === 'paid' && ratingBookingId !== b.id && (
                      <Button size="sm" onClick={() => setRatingBookingId(b.id)}>Confirm ride happened</Button>
                    )}
                  </div>
                  {b.status === 'paid' && ratingBookingId === b.id && (
                    <div className="w-full">
                      <RatingInput
                        busy={closingId === b.id}
                        submitLabel="Confirm ride happened"
                        onSubmit={(stars, comment) => closeBooking(b.id, stars, comment)}
                      />
                    </div>
                  )}
                  {b.status === 'closed' && b.rating && (
                    <div className="w-full">
                      <ProviderRatingSummaryDisplay summary={{ average: b.rating.stars, count: 1 }} />
                      {b.rating.comment && <p className="mt-1 text-sm text-text-secondary">{b.rating.comment}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
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
