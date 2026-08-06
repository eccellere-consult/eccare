'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/components/cart-context';

interface Me {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface FamilyRelation {
  elderUserId: string;
  elderUser: { id: string; name: string; address: string | null; city: string | null; state: string | null; pincode: string | null };
  inviteStatus: string;
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

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const cart = useCart();

  const [me, setMe] = useState<Me | null>(null);
  const [elders, setElders] = useState<FamilyRelation[]>([]);
  const [elderUserId, setElderUserId] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
      if (!meRes.success) return;
      const user: Me = meRes.data;
      setMe(user);

      if (user.role === 'elder') {
        setElderUserId(user.id);
        setAddress([user.address, user.city, user.state, user.pincode].filter(Boolean).join(', '));
      } else {
        const relRes = await fetch('/api/v1/family/members', { credentials: 'include' }).then((r) => r.json());
        if (relRes.success) {
          const accepted: FamilyRelation[] = relRes.data.filter((r: FamilyRelation) => r.inviteStatus === 'accepted');
          setElders(accepted);
          if (accepted.length === 1) {
            setElderUserId(accepted[0].elderUserId);
            const e = accepted[0].elderUser;
            setAddress([e.address, e.city, e.state, e.pincode].filter(Boolean).join(', '));
          }
        }
      }
    })();
  }, []);

  async function handlePay() {
    if (!elderUserId) {
      setError('Please choose who this order is for.');
      return;
    }
    if (!address.trim()) {
      setError('Please enter a delivery address.');
      return;
    }
    if (!cart.providerId || cart.items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const orderRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          elderUserId,
          providerId: cart.providerId,
          items: cart.items.map((i) => ({ catalogItemId: i.catalogItemId, quantity: i.quantity })),
          deliveryAddress: address,
        }),
      }).then((r) => r.json());

      if (!orderRes.success) throw new Error(orderRes.error?.message || 'Could not create order.');
      const { orderId, razorpayOrderId, amount, keyId } = orderRes.data;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: cart.providerName ?? 'Order',
        prefill: { name: me?.name, contact: me?.phone ?? undefined },
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/orders/${orderId}/verify-payment`, {
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
            cart.clearCart();
            router.push(me?.role === 'elder' ? '/elder/orders' : '/family/orders');
          } else {
            setError('Payment could not be verified. Please contact support before trying again.');
          }
        },
        modal: {
          // Cancels the 'pending' Order created above so a dismissed/abandoned
          // checkout doesn't leave an orphaned unpaid row behind — fire-and-forget
          // is fine here, the row is already excluded from the elder/family's own
          // order list regardless (see GET /api/v1/orders), this just cleans it up.
          ondismiss: () => {
            fetch(`/api/v1/orders/${orderId}/cancel`, { method: 'POST', credentials: 'include' }).catch(() => {});
            setBusy(false);
          },
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <Link
        href={`/community/vendors/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Checkout</h1>

      {(!cart.providerId || cart.items.length === 0) ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
            <ShoppingCart className="h-8 w-8 text-primary-600" />
            Your cart is empty.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="font-bold text-text">Order from {cart.providerName}</p>
              {cart.items.map((item) => (
                <div key={item.catalogItemId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{item.name}</p>
                    <p className="text-sm text-text-secondary">₹{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => cart.updateQuantity(item.catalogItemId, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-semibold text-text">{item.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => cart.updateQuantity(item.catalogItemId, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="text-danger-600" onClick={() => cart.removeItem(item.catalogItemId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-3 font-bold text-text">
                <span>Total</span>
                <span>₹{cart.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {me?.role !== 'elder' && elders.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="elder-select">Ordering for</Label>
                  <select
                    id="elder-select"
                    value={elderUserId}
                    onChange={(e) => {
                      setElderUserId(e.target.value);
                      const rel = elders.find((r) => r.elderUserId === e.target.value);
                      if (rel) setAddress([rel.elderUser.address, rel.elderUser.city, rel.elderUser.state, rel.elderUser.pincode].filter(Boolean).join(', '));
                    }}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    <option value="" disabled>Choose an elder</option>
                    {elders.map((r) => (
                      <option key={r.elderUserId} value={r.elderUserId}>{r.elderUser.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="address">Delivery address</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat, street, city, pincode" />
              </div>
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <Button size="lg" disabled={busy} onClick={handlePay} className="self-start">
                {busy ? 'Opening payment…' : `Pay ₹${cart.total.toFixed(2)} with Razorpay`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
