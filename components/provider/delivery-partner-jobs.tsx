'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Navigation, Package, Phone, RefreshCw, Star, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { communityApi } from '@/lib/community-client';

interface Available {
  id: string;
  pickupName: string;
  pickupAddress: string;
  dropAddress: string;
  roadKm: number | null;
  distanceToShopKm: number | null;
  weightKg: number | null;
  parcelSize: string | null;
  partnerEarning: number | null;
  cashToCollect: number | null;
}
interface Mine {
  id: string;
  status: 'accepted' | 'picked_up';
  pickupName: string;
  pickupPhone: string | null;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropName: string;
  dropPhone: string | null;
  dropAddress: string;
  dropLat: number | null;
  dropLng: number | null;
  roadKm: number | null;
  weightKg: number | null;
  parcelSize: string | null;
  partnerEarning: number | null;
  cashToCollect: number | null;
  cashToShop: number | null;
  order: { paymentMethod: string; items: { name: string; quantity: number }[] };
}
interface Done {
  id: string;
  pickupName: string;
  dropAddress: string;
  deliveredAt: string | null;
  partnerEarning: number | null;
  payoutStatus: string;
  payoutRef: string | null;
  rating: number | null;
  cashToShop: number | null;
  cashHandedToShopAt: string | null;
}
interface Jobs {
  canTakeMore: boolean;
  freeNow: boolean;
  verified: boolean;
  available: Available[];
  mine: Mine[];
  done: Done[];
  earnings: { unpaid: number; paid: number; keptFromCash: number; deliveries: number; ratingAverage: number | null };
}

const rupees = (n: number | null | undefined) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Google Maps directions to a point: the exact pin when we have one, otherwise the address. */
function directions(lat: number | null, lng: number | null, address: string) {
  const destination = lat !== null && lng !== null ? `${lat},${lng}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

const PAYOUT_LABEL: Record<string, string> = {
  unpaid: 'Payment due from EC',
  paid: 'Paid by EC',
  transferred: 'Sent to your bank',
  kept_from_cash: 'Kept from the cash',
};

/** A delivery partner's work list: take a delivery, carry it, finish it with the customer's code. */
export function DeliveryPartnerJobs() {
  const [jobs, setJobs] = useState<Jobs | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    communityApi
      .get<Jobs>('/provider/delivery/jobs')
      .then((data) => {
        setJobs(data);
        setLoadError('');
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load deliveries.'));
  }, []);

  useEffect(() => {
    load();
    // New deliveries appear without a reload while the page is open.
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function act(id: string, body: Record<string, string>, done: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await communityApi.post(`/provider/delivery/jobs/${id}`, body);
      setMessage({ id, text: done, ok: true });
      if (body.action === 'delivered') setCodes((c) => ({ ...c, [id]: '' }));
      load();
    } catch (err) {
      setMessage({ id, text: err instanceof Error ? err.message : 'Please try again.', ok: false });
      if (body.action === 'accept') load();
    } finally {
      setBusyId(null);
    }
  }

  if (loadError && !jobs) {
    return (
      <Card className="mt-4">
        <CardContent className="py-8 text-center text-text-secondary">{loadError}</CardContent>
      </Card>
    );
  }
  if (!jobs) return <p className="mt-4 text-text-secondary">Loading deliveries…</p>;

  const note = (id: string) =>
    message?.id === id ? (
      <p className={`text-sm font-semibold ${message.ok ? 'text-success-600' : 'text-danger-600'}`} role="status">
        {message.text}
      </p>
    ) : null;

  return (
    <div className="mt-4 flex flex-col gap-6">
      {/* Earnings first: the number a partner checks most. */}
      <section aria-labelledby="earn-h" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="earn-h" className="sr-only">
          Your earnings
        </h2>
        {[
          { label: 'Due from EC', value: rupees(jobs.earnings.unpaid) },
          { label: 'Paid to you', value: rupees(jobs.earnings.paid + jobs.earnings.keptFromCash) },
          { label: 'Deliveries', value: String(jobs.earnings.deliveries) },
          { label: 'Your rating', value: jobs.earnings.ratingAverage ? `${jobs.earnings.ratingAverage} ★` : 'No ratings yet' },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-text">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Deliveries I'm carrying */}
      {jobs.mine.length > 0 && (
        <section aria-labelledby="mine-h" className="flex flex-col gap-3">
          <h2 id="mine-h" className="text-lg font-bold text-text">
            Your deliveries now
          </h2>
          {jobs.mine.map((j) => {
            const cash = j.cashToCollect !== null;
            const picked = j.status === 'picked_up';
            return (
              <Card key={j.id} className="border-primary-100">
                <CardContent className="flex flex-col gap-4 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-900">
                      {picked ? 'Picked up · take it to the customer' : 'Accepted · go to the shop'}
                    </span>
                    <span className="text-sm font-semibold text-text">You earn {rupees(j.partnerEarning)}</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`rounded-xl border p-3 ${picked ? 'border-border opacity-70' : 'border-primary-100 bg-primary-50/40'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">1 · Pick up from</p>
                      <p className="mt-1 font-bold text-text">{j.pickupName}</p>
                      <p className="text-sm text-text-secondary">{j.pickupAddress}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={directions(j.pickupLat, j.pickupLng, j.pickupAddress)} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="outline" size="sm">
                            <Navigation className="h-4 w-4" /> Directions
                          </Button>
                        </a>
                        {j.pickupPhone && (
                          <a href={`tel:${j.pickupPhone}`}>
                            <Button type="button" variant="outline" size="sm">
                              <Phone className="h-4 w-4" /> Call shop
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-3 ${picked ? 'border-primary-100 bg-primary-50/40' : 'border-border'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">2 · Deliver to</p>
                      <p className="mt-1 font-bold text-text">{j.dropName}</p>
                      <p className="text-sm text-text-secondary">{j.dropAddress}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={directions(j.dropLat, j.dropLng, j.dropAddress)} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="outline" size="sm">
                            <Navigation className="h-4 w-4" /> Directions
                          </Button>
                        </a>
                        {j.dropPhone && (
                          <a href={`tel:${j.dropPhone}`}>
                            <Button type="button" variant="outline" size="sm">
                              <Phone className="h-4 w-4" /> Call customer
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-text-secondary">
                    <Package className="mr-1 inline h-4 w-4" />
                    {j.order.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                    {j.weightKg ? ` · about ${j.weightKg} kg` : ''}
                    {j.roadKm ? ` · ${j.roadKm} km` : ''}
                  </div>

                  {cash && (
                    <div className="rounded-xl bg-accent-50 p-3 text-sm text-text">
                      <Wallet className="mr-1 inline h-4 w-4" />
                      Cash order: collect <strong>{rupees(j.cashToCollect)}</strong> from the customer. Keep your{' '}
                      {rupees(j.partnerEarning)} and hand <strong>{rupees(j.cashToShop)}</strong> to {j.pickupName}.
                    </div>
                  )}

                  {!picked ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={busyId === j.id} onClick={() => act(j.id, { action: 'picked_up' }, 'Marked picked up. The customer has been told.')}>
                        <Package className="h-4 w-4" /> I have picked it up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === j.id}
                        onClick={() => act(j.id, { action: 'release' }, 'Given back. Another partner can take it.')}
                      >
                        Give it back
                      </Button>
                    </div>
                  ) : (
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        act(j.id, { action: 'delivered', code: (codes[j.id] ?? '').trim() }, 'Delivered. Thank you!');
                      }}
                    >
                      <label htmlFor={`code-${j.id}`} className="text-sm font-semibold text-text">
                        Ask the customer for their 4-digit delivery code
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          id={`code-${j.id}`}
                          value={codes[j.id] ?? ''}
                          onChange={(e) => setCodes((c) => ({ ...c, [j.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="1234"
                          className="w-32 text-center text-lg tracking-widest"
                        />
                        <Button type="submit" disabled={busyId === j.id || (codes[j.id] ?? '').length !== 4}>
                          <CheckCircle2 className="h-4 w-4" /> Delivered
                        </Button>
                      </div>
                    </form>
                  )}
                  {note(j.id)}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {/* Deliveries I can take */}
      <section aria-labelledby="avail-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="avail-h" className="text-lg font-bold text-text">
            Deliveries you can take
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
        {!jobs.verified ? (
          <p className="text-sm text-text-secondary">You will see deliveries here once EC has approved your account.</p>
        ) : !jobs.freeNow ? (
          <p className="text-sm text-text-secondary">
            You are not free right now. Switch on &quot;I am free now&quot; below, or wait for one of your free-time slots.
          </p>
        ) : !jobs.canTakeMore ? (
          <p className="text-sm text-text-secondary">Finish a delivery you are carrying before taking another.</p>
        ) : jobs.available.length === 0 ? (
          <p className="text-sm text-text-secondary">No deliveries near you just now. We will send you a notification when one comes.</p>
        ) : (
          jobs.available.map((j) => (
            <Card key={j.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-text">
                      <MapPin className="mr-1 inline h-4 w-4 text-primary-600" />
                      {j.pickupName}
                      {j.distanceToShopKm !== null && (
                        <span className="font-normal text-text-secondary"> · {j.distanceToShopKm} km from you</span>
                      )}
                    </p>
                    <p className="text-sm text-text-secondary">To: {j.dropAddress}</p>
                    <p className="text-sm text-text-secondary">
                      {j.roadKm ? `${j.roadKm} km trip` : 'Short trip'}
                      {j.weightKg ? ` · about ${j.weightKg} kg` : ''}
                      {j.parcelSize ? ` · ${j.parcelSize} parcel` : ''}
                      {j.cashToCollect !== null ? ` · cash order: collect ${rupees(j.cashToCollect)}` : ''}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-text">{rupees(j.partnerEarning)}</p>
                </div>
                <div>
                  <Button type="button" disabled={busyId === j.id} onClick={() => act(j.id, { action: 'accept' }, 'Accepted. Head to the shop.')}>
                    Accept this delivery
                  </Button>
                </div>
                {note(j.id)}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Finished */}
      {jobs.done.length > 0 && (
        <section aria-labelledby="done-h" className="flex flex-col gap-2">
          <h2 id="done-h" className="text-lg font-bold text-text">
            Finished deliveries
          </h2>
          <Card>
            <CardContent className="divide-y divide-border py-2">
              {jobs.done.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-text">
                      {j.pickupName} → {j.dropAddress}
                    </p>
                    <p className="text-text-secondary">
                      {j.deliveredAt ? new Date(j.deliveredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                      {' · '}
                      {PAYOUT_LABEL[j.payoutStatus] ?? j.payoutStatus}
                      {j.payoutRef ? ` (ref ${j.payoutRef})` : ''}
                      {j.cashToShop !== null && !j.cashHandedToShopAt ? ` · hand ${rupees(j.cashToShop)} to the shop` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {j.rating !== null && (
                      <span className="flex items-center gap-1 text-text-secondary">
                        <Star className="h-4 w-4 fill-current text-accent-600" /> {j.rating}
                      </span>
                    )}
                    <span className="font-bold tabular-nums text-text">{rupees(j.partnerEarning)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
