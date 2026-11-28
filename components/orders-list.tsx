'use client';

import { useEffect, useState } from 'react';
import { PackageCheck, RefreshCw, Bike, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RatingInput } from '@/components/rating-input';
import { ProviderRatingSummaryDisplay } from '@/components/provider-rating-summary';
import { RecurringOrderSuggestions } from '@/components/recurring-order-suggestions';
import { RecurringOrderTemplates } from '@/components/recurring-order-templates';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface OrderItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
  catalogItemId: string | null;
}

interface Rating {
  stars: number;
  comment: string | null;
}

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'confirmed' | 'delivered' | 'closed' | 'cancelled';
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
  provider: { businessName: string; category: string };
  rating: Rating | null;
  paymentMethod?: 'razorpay' | 'cod';
  deliveryCharge?: string | null;
  deliveryJob?: {
    id: string;
    status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
    handoverCode: string;
    charge: string;
    cashToCollect: string | null;
    rating: number | null;
    ratingComment: string | null;
    partner: { provider: { user: { name: string; phone: string | null } } } | null;
  } | null;
}

const STATUS_VARIANT = {
  pending: 'muted',
  paid: 'accent',
  confirmed: 'default',
  delivered: 'accent',
  closed: 'success',
  cancelled: 'danger',
} as const;
const STATUS_LABEL_KEY: Record<Order['status'], TranslationKey> = {
  pending: 'elder.orders.status.pending',
  paid: 'elder.orders.status.paid',
  confirmed: 'elder.orders.status.confirmed',
  delivered: 'elder.orders.status.delivered',
  closed: 'elder.orders.status.closed',
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
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingDeliveryId, setRatingDeliveryId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  // Keyed by catalogItemId — sourced from the elder's actual active
  // RecurringOrderTemplate rows (not a page-session-only "I just clicked this"
  // flag), so "Monthly reorder set up" still shows correctly after a reload,
  // not just immediately after clicking the button.
  const [activeReorderItemIds, setActiveReorderItemIds] = useState<Set<string>>(new Set());
  const [settingUpReorder, setSettingUpReorder] = useState<string | null>(null);
  // Bumped after a successful setUpReorder — remounts RecurringOrderTemplates
  // (a self-fetching component) so its own list picks up the new template
  // right away instead of waiting for an unrelated reload.
  const [reorderVersion, setReorderVersion] = useState(0);

  function load() {
    setLoading(true);
    const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
    return Promise.all([
      fetch(`/api/v1/orders${qs}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/v1/orders/recurring-templates${qs}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([ordersJson, templatesJson]) => {
        if (ordersJson.success) setOrders(ordersJson.data);
        if (templatesJson.success) {
          setActiveReorderItemIds(
            new Set(
              templatesJson.data
                .filter((tpl: { isActive: boolean }) => tpl.isActive)
                .map((tpl: { catalogItemId: string }) => tpl.catalogItemId),
            ),
          );
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderUserId]);

  async function closeOrder(orderId: string, stars: number, comment: string) {
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRatingOrderId(null);
        await load();
      }
    } finally {
      setClosing(false);
    }
  }

  async function rateDelivery(orderId: string, stars: number, comment: string) {
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/delivery-rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      });
      if (res.ok) {
        setRatingDeliveryId(null);
        await load();
      }
    } finally {
      setClosing(false);
    }
  }

  async function setUpReorder(orderId: string) {
    setSettingUpReorder(orderId);
    try {
      const res = await fetch('/api/v1/orders/recurring-templates/from-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await load();
        setReorderVersion((v) => v + 1);
      }
    } finally {
      setSettingUpReorder(null);
    }
  }

  if (loading) return <p className="text-text-secondary">{t('common.loading')}</p>;

  if (orders.length === 0) {
    return (
      <>
        <RecurringOrderTemplates key={reorderVersion} elderUserId={elderUserId} />
        <RecurringOrderSuggestions elderUserId={elderUserId} onApproved={load} />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
            <PackageCheck className="h-8 w-8 text-primary-600" />
            {t('elder.orders.noOrders')}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RecurringOrderSuggestions elderUserId={elderUserId} onApproved={load} />
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
            {o.deliveryCharge && (
              <p className="text-xs text-text-secondary">
                {t('elder.orders.delivery.charge').replace('{amount}', String(Number(o.deliveryCharge)))}
              </p>
            )}

            {o.deliveryJob && o.deliveryJob.status !== 'cancelled' && (() => {
              const job = o.deliveryJob;
              const partner = job.partner?.provider.user;
              const name = partner?.name ?? '';
              const line =
                job.status === 'open'
                  ? t('elder.orders.delivery.waiting')
                  : job.status === 'accepted'
                    ? t('elder.orders.delivery.accepted').replace('{name}', name)
                    : job.status === 'picked_up'
                      ? t('elder.orders.delivery.pickedUp').replace('{name}', name)
                      : t('elder.orders.delivery.delivered').replace('{name}', name);
              return (
                <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50 p-3">
                  <p className="flex items-center gap-2 font-semibold text-text">
                    <Bike className="h-5 w-5 shrink-0 text-primary-600" /> {line}
                  </p>
                  {job.status !== 'delivered' && (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-text-secondary">{t('elder.orders.delivery.code')}</span>
                        <span className="rounded-lg bg-surface px-3 py-1 font-mono text-2xl font-bold tracking-[0.3em] text-text">{job.handoverCode}</span>
                        {partner?.phone && (
                          <a href={`tel:${partner.phone}`} className="ml-auto flex min-h-tap items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-primary-600">
                            <Phone className="h-4 w-4" /> {t('elder.orders.delivery.call')}
                          </a>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{t('elder.orders.delivery.codeHint')}</p>
                      {job.cashToCollect && (
                        <p className="mt-2 text-sm font-semibold text-text">
                          {t('elder.orders.delivery.payCash').replace('{amount}', String(Number(job.cashToCollect)))}
                        </p>
                      )}
                    </>
                  )}
                  {job.status === 'delivered' && job.rating === null && (
                    ratingDeliveryId === job.id ? (
                      <div className="mt-2">
                        <RatingInput busy={closing} submitLabel={t('elder.orders.delivery.rate')} onSubmit={(stars, comment) => rateDelivery(o.id, stars, comment)} />
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setRatingDeliveryId(job.id)}>
                        {t('elder.orders.delivery.rate')}
                      </Button>
                    )
                  )}
                  {job.rating !== null && (
                    <div className="mt-2">
                      <ProviderRatingSummaryDisplay summary={{ average: job.rating, count: 1 }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {o.status === 'delivered' && (
              ratingOrderId === o.id ? (
                <div className="mt-3">
                  <RatingInput
                    busy={closing}
                    submitLabel={t('elder.orders.confirmReceived')}
                    onSubmit={(stars, comment) => closeOrder(o.id, stars, comment)}
                  />
                </div>
              ) : (
                <Button size="sm" className="mt-3" onClick={() => setRatingOrderId(o.id)}>
                  {t('elder.orders.confirmReceived')}
                </Button>
              )
            )}

            {o.status === 'closed' && o.rating && (
              <div className="mt-3">
                <ProviderRatingSummaryDisplay summary={{ average: o.rating.stars, count: 1 }} />
                {o.rating.comment && <p className="mt-1 text-sm text-text-secondary">{o.rating.comment}</p>}
              </div>
            )}

            {o.provider.category === 'pharmacy' && (o.status === 'closed' || o.status === 'confirmed' || o.status === 'delivered') && (
              o.items.some((i) => i.catalogItemId) && o.items.every((i) => !i.catalogItemId || activeReorderItemIds.has(i.catalogItemId)) ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success-600">
                  <RefreshCw className="h-3.5 w-3.5" /> Monthly reorder set up
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={settingUpReorder === o.id}
                  onClick={() => setUpReorder(o.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {settingUpReorder === o.id ? 'Setting up…' : 'Set up monthly reorder'}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
