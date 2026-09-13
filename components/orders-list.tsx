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

/** Shared between the elder's own page and the family "For [Elder] / For
 *  myself" page — same underlying /api/v1/orders, canAccessElder allows
 *  either side to view. Reads useLanguage() defensively (null outside a
 *  LanguageProvider) so it lights up translated only on the elder side, same
 *  pattern as components/payments-due.tsx. Omitting elderUserId lets the API
 *  default to the caller's own orders (the elder's own page does this). */
export function OrdersList({ elderUserId }: { elderUserId?: string }) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
    fetch(`/api/v1/orders${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setOrders(j.data); })
      .finally(() => setLoading(false));
  }, [elderUserId]);

  if (loading) return <p className="text-text-secondary">{t('common.loading')}</p>;

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
          <PackageCheck className="h-8 w-8 text-primary-600" />
          {t('elder.orders.noOrders')}
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}
