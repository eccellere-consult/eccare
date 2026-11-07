'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface Props {
  token: string;
  name: string;
  status: 'trialing' | 'active' | 'expired';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  monthlyPrice: number;
  annualPrice: number;
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

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function FamilyPayClient({ token, name, status, trialEndsAt, currentPeriodEnd, monthlyPrice, annualPrice }: Props) {
  const [busy, setBusy] = useState<'monthly' | 'annual' | null>(null);
  const [error, setError] = useState('');
  const [paidUntil, setPaidUntil] = useState<string | null>(status === 'active' ? currentPeriodEnd : null);

  async function pay(billingCycle: 'monthly' | 'annual') {
    setError('');
    setBusy(billingCycle);
    try {
      const orderRes = await fetch('/api/v1/family/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle, payToken: token }),
      }).then((r) => r.json());
      if (!orderRes.success) throw new Error(orderRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = orderRes.data;

      if (!(await loadRazorpayScript())) {
        throw new Error('Could not load the payment page. Please check your connection and try again.');
      }

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: billingCycle === 'annual' ? 'Family plan — annual' : 'Family plan — monthly',
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch('/api/v1/family/subscription/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              payToken: token,
            }),
          }).then((r) => r.json());
          if (verifyRes.success) {
            setPaidUntil(verifyRes.data?.currentPeriodEnd ?? new Date().toISOString());
            setBusy(null);
          } else {
            setError('Payment could not be verified. Please contact care@eccare.in before trying again.');
            setBusy(null);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Please try again.');
      setBusy(null);
    }
  }

  if (paidUntil) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text">Thank you{name ? `, ${name.split(' ')[0]}` : ''}</h1>
        <p className="mt-2 text-text-secondary">
          Your family plan is active until {fmt(paidUntil)}. Open the EC app again and your family access is back.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{name ? `Hello, ${name.split(' ')[0]}` : 'Your family plan'}</h1>
      <p className="mt-2 text-text-secondary">
        {status === 'trialing' && trialEndsAt
          ? `Your free trial runs until ${fmt(trialEndsAt)}. You can start your plan now.`
          : 'Your free trial has ended. Choose a plan to get your family access back.'}{' '}
        Your elder&rsquo;s own account stays free.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Button size="lg" disabled={busy !== null} onClick={() => pay('monthly')}>
          {busy === 'monthly' ? 'Opening payment…' : `Pay ₹${monthlyPrice} — Monthly`}
        </Button>
        <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => pay('annual')}>
          {busy === 'annual' ? 'Opening payment…' : `Pay ₹${annualPrice} — Annual`}
        </Button>
      </div>
      {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
