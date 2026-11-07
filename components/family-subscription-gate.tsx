'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface SubscriptionState {
  status: 'trialing' | 'active' | 'expired';
  billingCycle: 'monthly' | 'annual';
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

/** Rendered by app/family/layout.tsx in place of the real portal whenever the
 *  server-side check finds the caller's family subscription expired — a hard
 *  block, not a dismissible banner, per how this was scoped. Pay for either
 *  cycle regardless of what they originally chose at registration; paying
 *  switches billingCycle to match going forward. */
export function FamilySubscriptionGate({ inApp = false }: { inApp?: boolean }) {
  if (inApp) return <InAppPendingGate />;
  return <WebSubscriptionGate />;
}

/** Inside the Android app Google Play does not allow a price, a pay button or a
 *  link to a payment page for a digital subscription. So the app only says the
 *  plan is waiting for payment and sends the person the details OUTSIDE the app
 *  (email, WhatsApp). Their own elder's account is untouched. */
function InAppPendingGate() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  async function send(auto: boolean) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/v1/family/subscription/send-pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ auto }),
      }).then((res) => res.json());
      if (!r.success) throw new Error(r.error?.message || 'We could not send the details just now.');
      if (r.data?.sent) {
        const ch: string[] = r.data.channels ?? [];
        setNote(`We have sent the details to your ${ch.includes('email') && ch.includes('whatsapp') ? 'email and WhatsApp' : ch.includes('whatsapp') ? 'WhatsApp' : 'email'}.`);
      } else if (!auto) {
        setNote('We sent the details a moment ago. Please check your email or WhatsApp.');
      } else {
        setNote('We have already sent the details to you. Please check your email or WhatsApp.');
      }
    } catch (err) {
      if (!auto) setError(err instanceof Error ? err.message : 'We could not send the details just now.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <h1 className="text-2xl font-bold text-text">Your family plan is waiting for payment</h1>
          <p className="mt-2 text-text-secondary">
            Your elder&rsquo;s own account stays completely free and keeps working. Your family access opens again as
            soon as your plan is paid.
          </p>
          {note && <p className="mt-4 text-sm font-semibold text-success-600">{note}</p>}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              disabled={checking}
              onClick={() => {
                setChecking(true);
                router.refresh();
                setTimeout(() => setChecking(false), 2500);
              }}
            >
              {checking ? 'Checking…' : "I've paid — check again"}
            </Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => send(false)}>
              {busy ? 'Sending…' : 'Send me the details again'}
            </Button>
          </div>
          {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
          <p className="mt-4 text-xs text-text-secondary">Questions? Write to care@eccare.in</p>
        </CardContent>
      </Card>
    </div>
  );
}

function WebSubscriptionGate() {
  const router = useRouter();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState<'monthly' | 'annual' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/family/subscription', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setState(j.data); })
      .catch(() => {});
  }, []);

  async function pay(billingCycle: 'monthly' | 'annual') {
    setError('');
    setBusy(billingCycle);
    try {
      const orderRes = await fetch('/api/v1/family/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billingCycle }),
      }).then((r) => r.json());
      if (!orderRes.success) throw new Error(orderRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = orderRes.data;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

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
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());

          if (verifyRes.success) {
            router.refresh();
          } else {
            setError('Payment could not be verified. Please contact support before trying again.');
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <h1 className="text-2xl font-bold text-text">
            {state?.status === 'trialing' ? 'Your free trial has ended' : 'Your family plan has expired'}
          </h1>
          <p className="mt-2 text-text-secondary">
            Your elder&rsquo;s own account stays completely free — this covers your own family access.
            Pay to continue.
          </p>

          {state && (
            <div className="mt-6 flex flex-col gap-3">
              <Button size="lg" disabled={busy !== null} onClick={() => pay('monthly')}>
                {busy === 'monthly' ? 'Opening payment…' : `Pay ₹${state.monthlyPrice} — Monthly`}
              </Button>
              <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => pay('annual')}>
                {busy === 'annual' ? 'Opening payment…' : `Pay ₹${state.annualPrice} — Annual`}
              </Button>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
