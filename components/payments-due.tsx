'use client';

import { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FeeCharge {
  id: string;
  period: string;
  amount: string;
  status: 'due' | 'paid' | 'waived';
  dueDate: string;
  paidAt: string | null;
  razorpayOrderId: string | null;
  communityFee: { label: string };
  neighborhoodMember: { flatNumber: string | null };
}

interface Me {
  name: string;
  phone: string | null;
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

/** Shared between the elder's own page and the family per-elder page — same
 *  underlying /api/v1/community/fee-charges, canAccessElder allows either side to
 *  view and pay. Mirrors the vendor checkout flow (app/community/vendors/[id]/
 *  checkout/page.tsx) for the actual Razorpay integration. */
export function PaymentsDue({ elderUserId }: { elderUserId: string }) {
  const [charges, setCharges] = useState<FeeCharge[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/community/fee-charges?elderUserId=${elderUserId}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not load payments.');
      setCharges(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, [elderUserId]);

  useEffect(() => {
    load();
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMe(j.data); })
      .catch(() => {});
  }, [load]);

  async function pay(charge: FeeCharge) {
    setPayingId(charge.id);
    setError('');
    try {
      const payRes = await fetch(`/api/v1/community/fee-charges/${charge.id}/pay`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json());
      if (!payRes.success) throw new Error(payRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = payRes.data;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: charge.communityFee.label,
        prefill: { name: me?.name, contact: me?.phone ?? undefined },
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/community/fee-charges/${charge.id}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());

          if (verifyRes.success) {
            load();
          } else {
            setError('Payment could not be verified. Please contact support before trying again.');
          }
          setPayingId(null);
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Please try again.');
      setPayingId(null);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error && charges.length === 0) return <p className="text-danger-600">{error}</p>;

  const due = charges.filter((c) => c.status === 'due');
  const settled = charges.filter((c) => c.status !== 'due');

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-danger-600">{error}</p>}

      <section>
        <h2 className="text-lg font-bold text-text">Due</h2>
        {due.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-text-secondary">
              <Check className="h-8 w-8 text-success-600" />
              Nothing due right now.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {due.map((c) => {
              const overdue = new Date(c.dueDate) < new Date();
              return (
                <Card key={c.id} className={overdue ? 'border-danger-100 bg-danger-50' : undefined}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-bold text-text">{c.communityFee.label}</p>
                      <p className="text-sm text-text-secondary">
                        {c.period}{c.neighborhoodMember.flatNumber ? ` · ${c.neighborhoodMember.flatNumber}` : ''}
                      </p>
                      <p className={`mt-1 flex items-center gap-1 text-sm ${overdue ? 'font-semibold text-danger-600' : 'text-text-secondary'}`}>
                        {overdue && <AlertCircle className="h-4 w-4" />}
                        {overdue ? 'Overdue — ' : 'Due '}
                        {new Date(c.dueDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-text">₹{c.amount}</span>
                      <Button size="sm" disabled={payingId === c.id} onClick={() => pay(c)}>
                        {payingId === c.id ? 'Opening…' : 'Pay now'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-text">History</h2>
          <div className="mt-3 flex flex-col gap-2">
            {settled.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{c.communityFee.label}</p>
                  <p className="text-sm text-text-secondary">
                    {c.period}
                    {c.paidAt && ` · Paid ${new Date(c.paidAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text">₹{c.amount}</span>
                  <Badge variant={c.status === 'paid' ? 'success' : 'muted'}>{c.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {charges.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
            <IndianRupee className="h-8 w-8 text-primary-600" />
            No community fees yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
