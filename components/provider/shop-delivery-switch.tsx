'use client';

import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { communityApi } from '@/lib/community-client';
import { DELIVERY_CATEGORY } from '@/lib/delivery-pricing';

/**
 * A shop chooses whether EC delivery partners carry its orders. Shown only once delivery is
 * switched on by EC, and never to delivery partners themselves. Off = the shop delivers its
 * own orders: no delivery charge is added and no delivery job is opened.
 */
export function ShopDeliverySwitch() {
  const [state, setState] = useState<{ uses: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      communityApi.get<{ enabled: boolean }>('/delivery/status'),
      communityApi.get<{ category: string; usesEcDelivery?: boolean }>('/provider/profile'),
    ])
      .then(([status, profile]) => {
        if (status.enabled && profile.category !== DELIVERY_CATEGORY.value) {
          setState({ uses: profile.usesEcDelivery !== false });
        }
      })
      .catch(() => setState(null));
  }, []);

  if (!state) return null;

  async function toggle() {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const saved = await communityApi.patch<{ usesEcDelivery: boolean }>('/provider/profile', { usesEcDelivery: !state.uses });
      setState({ uses: saved.usesEcDelivery });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-start gap-3">
          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <p className="font-semibold text-text">EC delivery partners carry my orders</p>
            <p className="text-sm text-text-secondary">
              {state.uses
                ? 'The customer pays the delivery charge with the order; a local partner picks it up from you.'
                : 'You deliver your own orders. No delivery charge is added.'}
            </p>
            {error && <p className="mt-1 text-sm font-semibold text-danger-600">{error}</p>}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.uses}
          aria-label="EC delivery partners carry my orders"
          disabled={busy}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60 ${
            state.uses ? 'bg-primary-600' : 'bg-border'
          }`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${state.uses ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </CardContent>
    </Card>
  );
}
