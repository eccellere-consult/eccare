'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

interface Suggestion {
  id: string;
  template: {
    unitsPerMonth: number;
    catalogItem: { name: string; price: string; inStock: boolean };
    provider: { businessName: string };
  };
}

/** Pharmacy auto-reorder: shows any pending monthly-reorder suggestions
 *  (generated lazily by the GET route itself — see lib/recurring-orders.ts)
 *  above the order list, with Approve (places and pays for the order,
 *  same Razorpay flow as a manual checkout) / Decline actions. Nothing is
 *  ever charged without this explicit approval step. */
export function RecurringOrderSuggestions({ elderUserId, onApproved }: { elderUserId?: string; onApproved: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
    fetch(`/api/v1/orders/recurring-suggestions${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setSuggestions(j.data); })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderUserId]);

  async function decline(id: string) {
    setBusyId(id);
    setError('');
    try {
      await fetch(`/api/v1/orders/recurring-suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'decline' }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function approve(s: Suggestion) {
    setBusyId(s.id);
    setError('');
    try {
      const res = await fetch(`/api/v1/orders/recurring-suggestions/${s.id}/approve`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
      if (!res.success) throw new Error(res.error?.message || 'Could not start payment.');
      const { orderId, razorpayOrderId, amount, keyId } = res.data;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: `Monthly reorder — ${s.template.catalogItem.name}`,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await fetch(`/api/v1/orders/${orderId}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          load();
          onApproved();
          setBusyId(null);
        },
        modal: { ondismiss: () => setBusyId(null) },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment.');
      setBusyId(null);
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {suggestions.map((s) => (
        <Card key={s.id} className="border-accent-100 bg-accent-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
                <RefreshCw className="h-5 w-5 text-accent-600" />
              </span>
              <div>
                <p className="font-bold text-text">
                  Time to reorder: {s.template.catalogItem.name} × {s.template.unitsPerMonth}
                </p>
                <p className="text-sm text-text-secondary">
                  {s.template.provider.businessName} · ₹{(Number(s.template.catalogItem.price) * s.template.unitsPerMonth).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busyId === s.id || !s.template.catalogItem.inStock} onClick={() => approve(s)}>
                {busyId === s.id ? 'Opening…' : 'Approve & pay'}
              </Button>
              <Button size="sm" variant="outline" disabled={busyId === s.id} onClick={() => decline(s.id)}>
                Skip this month
              </Button>
            </div>
          </CardContent>
          {!s.template.catalogItem.inStock && <p className="px-6 pb-3 text-sm text-danger-600">Currently out of stock.</p>}
        </Card>
      ))}
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
