import Link from 'next/link';
import { ArrowLeft, Bike } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { DeliveryPartnerSelfService } from '@/components/provider/delivery-partner-self-service';
import { DELIVERY_CATEGORY } from '@/lib/delivery-pricing';

export const dynamic = 'force-dynamic';

/** A delivery partner's own page: vehicle, how far and how heavy, UPI, and weekly free time. */
export default async function ProviderDeliveryPage() {
  const user = await getServerUser();
  const provider = user
    ? await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { category: true } })
    : null;

  const backLink = (
    <Link href="/provider" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
      <ArrowLeft className="h-4 w-4" /> Provider home
    </Link>
  );

  return (
    <div>
      {backLink}
      <h1 className="mt-3 text-2xl font-bold text-text">Delivery</h1>
      {provider?.category === DELIVERY_CATEGORY.value ? (
        <>
          <p className="mt-1 text-text-secondary">Tell EC when you are free and what you can carry.</p>
          <DeliveryPartnerSelfService />
        </>
      ) : (
        <Card className="mt-4">
          <CardContent className="flex items-start gap-4 py-8">
            <Bike className="h-6 w-6 shrink-0 text-text-secondary" />
            <div>
              <p className="font-bold text-text">This page is for delivery partner accounts</p>
              <p className="mt-1 text-sm text-text-secondary">
                {provider ? 'Your account is registered under a different category.' : 'Complete your service provider profile first.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
