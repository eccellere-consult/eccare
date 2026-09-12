'use client';

import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

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

const STATUS_VARIANT = { pending: 'muted', paid: 'accent', confirmed: 'success', cancelled: 'danger' } as const;
const STATUS_LABEL_KEY: Record<Order['status'], TranslationKey> = {
  pending: 'elder.orders.status.pending',
  paid: 'elder.orders.status.paid',
  confirmed: 'elder.orders.status.confirmed',
  cancelled: 'elder.orders.status.cancelled',
};

export default function ElderOrdersPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setOrders(j.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t('elder.orders.title')}</h1>
      <p className="mt-1 text-text-secondary">{t('elder.orders.subtitle')}</p>

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">{t('common.loading')}</p>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
              <PackageCheck className="h-8 w-8 text-primary-600" />
              {t('elder.orders.noOrders')}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-bold text-text">{o.provider.businessName}</p>
                    <Badge variant={STATUS_VARIANT[o.status]}>{t(STATUS_LABEL_KEY[o.status])}</Badge>
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
