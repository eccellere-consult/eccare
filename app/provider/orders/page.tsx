'use client';

import { useEffect, useState } from 'react';
import { PackageCheck, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
}

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled';
  totalAmount: string;
  deliveryAddress: string;
  createdAt: string;
  items: OrderItem[];
  elderUser: { name: string; phone: string | null };
}

const STATUS_VARIANT = { pending: 'muted', paid: 'accent', confirmed: 'success', cancelled: 'danger' } as const;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setOrders(await api('/provider/orders'));
    } catch {
      /* leave list empty */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, status: 'confirmed' | 'cancelled') {
    setBusyId(id);
    try {
      await api(`/provider/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Incoming orders</h1>
      <p className="mt-1 text-text-secondary">Orders placed against your catalog.</p>

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
              <PackageCheck className="h-8 w-8 text-primary-600" />
              No orders yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-text">{o.elderUser.name}</p>
                      {o.elderUser.phone && (
                        <a href={`tel:${o.elderUser.phone}`} className="mt-0.5 flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                          <Phone className="h-3.5 w-3.5" />
                          {o.elderUser.phone}
                        </a>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{o.deliveryAddress}</p>
                  <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                    {o.items.map((i) => (
                      <div key={i.id} className="flex justify-between">
                        <span>{i.name} × {i.quantity}</span>
                        <span>₹{(Number(i.price) * i.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between font-bold text-text">
                      <span>Total</span>
                      <span>₹{o.totalAmount}</span>
                    </div>
                  </div>
                  {o.status === 'paid' && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" disabled={busyId === o.id} onClick={() => decide(o.id, 'confirmed')}>
                        Confirm order
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger-600" disabled={busyId === o.id} onClick={() => decide(o.id, 'cancelled')}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
