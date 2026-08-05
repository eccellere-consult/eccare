'use client';

import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  createdAt: string;
  items: OrderItem[];
  provider: { businessName: string };
}

interface FamilyRelation {
  elderUserId: string;
  elderUser: { name: string };
  inviteStatus: string;
}

const STATUS_VARIANT = { pending: 'muted', paid: 'accent', confirmed: 'success', cancelled: 'danger' } as const;

export default function FamilyOrdersPage() {
  const [elders, setElders] = useState<FamilyRelation[]>([]);
  const [elderUserId, setElderUserId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/family/members', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const accepted = j.data.filter((r: FamilyRelation) => r.inviteStatus === 'accepted');
          setElders(accepted);
          if (accepted.length > 0) setElderUserId(accepted[0].elderUserId);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!elderUserId) return;
    setLoading(true);
    fetch(`/api/v1/orders?elderUserId=${elderUserId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setOrders(j.data); })
      .finally(() => setLoading(false));
  }, [elderUserId]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Orders</h1>
      <p className="mt-1 text-text-secondary">Purchases from community vendors.</p>

      {elders.length > 1 && (
        <div className="mt-4 flex gap-2">
          {elders.map((r) => (
            <button
              key={r.elderUserId}
              onClick={() => setElderUserId(r.elderUserId)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${elderUserId === r.elderUserId ? 'bg-primary-600 text-white' : 'border border-border text-text'}`}
            >
              {r.elderUser.name}
            </button>
          ))}
        </div>
      )}

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
                    <p className="font-bold text-text">{o.provider.businessName}</p>
                    <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-text-secondary">
                    {o.items.map((i) => (
                      <span key={i.id}>{i.name} × {i.quantity}</span>
                    ))}
                  </div>
                  <p className="mt-2 font-bold text-text">₹{o.totalAmount}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
