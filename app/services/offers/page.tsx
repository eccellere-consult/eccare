'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OfferCard, type PublicOffer } from '@/components/offers/offer-card';

/**
 * Offers from local services, in one quiet place that elders and families open when they want
 * to: no pop-ups, nothing moving, nothing elsewhere in the app. Every offer was paid for and
 * approved by EC. At most one "Sponsored" card sits at the top.
 */
export default function OffersPage() {
  const [data, setData] = useState<{ enabled: boolean; ad: PublicOffer | null; offers: PublicOffer[] } | null>(null);

  useEffect(() => {
    fetch('/api/v1/offers', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setData(j?.success ? j.data : { enabled: true, ad: null, offers: [] }))
      .catch(() => setData({ enabled: true, ad: null, offers: [] }));
  }, []);

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Services
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-text">
        <Megaphone className="h-6 w-6 text-primary-600" /> Offers
      </h1>
      <p className="mt-1 text-text-secondary">Offers from local services, checked by EC. Call, WhatsApp or ask a question.</p>

      {!data ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : !data.enabled ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-text-secondary">Offers are coming soon.</CardContent>
        </Card>
      ) : (
        <>
          {data.ad && (
            <div className="mt-6">
              <OfferCard offer={data.ad} sponsored />
            </div>
          )}
          {data.offers.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-12 text-center text-text-secondary">No offers right now. Please look again later.</CardContent>
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data.offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
