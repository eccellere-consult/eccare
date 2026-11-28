'use client';

import { useState } from 'react';
import { Package, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { communityApi } from '@/lib/community-client';

export interface AdminJob {
  id: string;
  status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  pickupName: string;
  dropName: string;
  dropAddress: string;
  charge: number;
  partnerEarning: number;
  cashToCollect: number | null;
  cashToShop: number | null;
  cashHandedToShopAt: string | null;
  payoutStatus: 'unpaid' | 'paid' | 'transferred' | 'kept_from_cash' | string;
  payoutRef: string | null;
  rating: number | null;
  createdAt: string;
  deliveredAt: string | null;
  order: { paymentMethod: string; totalAmount: number };
  partner: {
    upiId: string | null;
    razorpayLinkedAccountId: string | null;
    provider: { user: { name: string; phone: string | null } };
  } | null;
}

const STATUS: Record<AdminJob['status'], { label: string; variant: 'accent' | 'success' | 'danger' | 'muted' }> = {
  open: { label: 'Waiting for a partner', variant: 'accent' },
  accepted: { label: 'Going to the shop', variant: 'accent' },
  picked_up: { label: 'On the way', variant: 'accent' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};
const PAYOUT: Record<string, string> = {
  unpaid: 'Partner not paid yet',
  paid: 'Paid by UPI',
  transferred: 'Sent by Razorpay',
  kept_from_cash: 'Kept from the cash',
};
const rupees = (n: number | null) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Admin's list of recent deliveries: pay the partner (UPI outside EC, then record the
 * reference), retry an automatic Razorpay payout, or cancel and refund the customer.
 */
export function DeliveryJobsAdmin({ jobs, routePayouts, onChanged }: { jobs: AdminJob[]; routePayouts: boolean; onChanged: () => void }) {
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<'action' | 'all'>('action');

  const needsAction = (j: AdminJob) =>
    j.status === 'open' || j.status === 'accepted' || j.status === 'picked_up' || (j.status === 'delivered' && j.payoutStatus === 'unpaid');
  const shown = filter === 'action' ? jobs.filter(needsAction) : jobs;

  async function act(id: string, body: Record<string, string>, done: string) {
    setBusyId(id);
    setNote(null);
    try {
      await communityApi.post(`/admin/delivery/jobs/${id}`, body);
      setNote({ id, text: done, ok: true });
      onChanged();
    } catch (err) {
      setNote({ id, text: err instanceof Error ? err.message : 'Please try again.', ok: false });
    } finally {
      setBusyId(null);
    }
  }

  function cancel(j: AdminJob) {
    const online = j.order.paymentMethod === 'razorpay';
    const reason = window.prompt(
      online
        ? `Cancel this order and refund ${rupees(j.order.totalAmount)} to the customer's card or UPI? This cannot be undone.\n\nType the reason the customer will see:`
        : 'Cancel this cash order? Nothing has been paid, so there is nothing to refund.\n\nType the reason the customer will see:',
    );
    if (!reason || reason.trim().length < 3) return;
    act(j.id, { action: 'cancel_refund', reason: reason.trim() }, online ? 'Cancelled and refunded.' : 'Cancelled.');
  }

  return (
    <section aria-labelledby="jobs-h" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="jobs-h" className="flex items-center gap-2 text-lg font-bold text-text">
          <Package className="h-5 w-5 text-primary-600" /> Deliveries
          <span className="text-sm font-normal text-text-secondary">· latest {jobs.length}</span>
        </h2>
        <div className="flex gap-2" role="group" aria-label="Which deliveries to show">
          <Button size="sm" variant={filter === 'action' ? 'primary' : 'outline'} onClick={() => setFilter('action')}>
            Needs action ({jobs.filter(needsAction).length})
          </Button>
          <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
            All
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-8 text-center text-text-secondary">
            {jobs.length === 0 ? 'No deliveries yet. They appear here when shops accept orders.' : 'Nothing needs you right now.'}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {shown.map((j) => {
            const s = STATUS[j.status];
            const partnerName = j.partner?.provider.user.name;
            const canPayByUpi = j.status === 'delivered' && j.payoutStatus === 'unpaid';
            const canRetryRoute = canPayByUpi && routePayouts && j.order.paymentMethod === 'razorpay';
            const canCancel = j.status !== 'delivered' && j.status !== 'cancelled';
            return (
              <Card key={j.id}>
                <CardContent className="flex flex-col gap-3 pt-5 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-text">
                        {j.pickupName} → {j.dropName}
                      </p>
                      <p className="text-text-secondary">{j.dropAddress}</p>
                      <p className="text-text-secondary">
                        {new Date(j.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                        {j.order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'} · order {rupees(j.order.totalAmount)}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-text-secondary">Delivery charge</dt>
                      <dd className="font-semibold tabular-nums text-text">{rupees(j.charge)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Partner earns</dt>
                      <dd className="font-semibold tabular-nums text-text">{rupees(j.partnerEarning)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Partner</dt>
                      <dd className="text-text">
                        {partnerName ?? '—'}
                        {j.partner?.provider.user.phone ? ` · ${j.partner.provider.user.phone}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Payout</dt>
                      <dd className="text-text">
                        {j.status === 'delivered' ? PAYOUT[j.payoutStatus] ?? j.payoutStatus : '—'}
                        {j.payoutRef ? ` (${j.payoutRef})` : ''}
                      </dd>
                    </div>
                  </dl>

                  {j.cashToShop !== null && j.status === 'delivered' && (
                    <p className={j.cashHandedToShopAt ? 'text-text-secondary' : 'font-semibold text-accent-900'}>
                      {j.cashHandedToShopAt
                        ? `Shop confirmed it received ${rupees(j.cashToShop)} from the partner.`
                        : `The shop has not yet confirmed receiving ${rupees(j.cashToShop)} cash from the partner.`}
                    </p>
                  )}
                  {j.rating !== null && (
                    <p className="flex items-center gap-1 text-text-secondary">
                      <Star className="h-4 w-4 fill-current text-accent-600" /> Customer rated the delivery {j.rating}/5
                    </p>
                  )}

                  {(canPayByUpi || canCancel) && (
                    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                      {canPayByUpi && (
                        <>
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`ref-${j.id}`} className="text-xs font-semibold text-text-secondary">
                              Paid {rupees(j.partnerEarning)} to {j.partner?.upiId ?? 'their UPI'}? UPI reference
                            </label>
                            <Input
                              id={`ref-${j.id}`}
                              className="h-9 w-56"
                              value={refs[j.id] ?? ''}
                              onChange={(e) => setRefs((r) => ({ ...r, [j.id]: e.target.value }))}
                              placeholder="e.g. 4321 5678 9012"
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={busyId === j.id || (refs[j.id] ?? '').trim().length < 3}
                            onClick={() => act(j.id, { action: 'mark_paid', ref: (refs[j.id] ?? '').trim() }, 'Marked paid.')}
                          >
                            Mark paid
                          </Button>
                          {canRetryRoute && (
                            <Button size="sm" variant="outline" disabled={busyId === j.id} onClick={() => act(j.id, { action: 'retry_route' }, 'Sent by Razorpay.')}>
                              Send by Razorpay
                            </Button>
                          )}
                        </>
                      )}
                      {canCancel && (
                        <Button size="sm" variant="outline" className="text-danger-600" disabled={busyId === j.id} onClick={() => cancel(j)}>
                          {j.order.paymentMethod === 'razorpay' ? 'Cancel and refund' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  )}
                  {note?.id === j.id && (
                    <p className={`font-semibold ${note.ok ? 'text-success-600' : 'text-danger-600'}`} role="status">
                      {note.text}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
