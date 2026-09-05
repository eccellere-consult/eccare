import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { PropertyManagementSelfService } from '@/components/provider/property-management-self-service';

export const dynamic = 'force-dynamic';

/** Same discoverability fix as /provider/appointments (Doctors) — this used
 *  to only exist as a section on Provider Overview, conditional on category
 *  and easy to miss entirely. Now a real, always-reachable page. */
export default async function ProviderPropertyManagementPage() {
  const user = await getServerUser();
  const provider = user ? await prisma.serviceProvider.findUnique({ where: { userId: user.id } }) : null;

  const backLink = (
    <Link href="/provider" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
      <ArrowLeft className="h-4 w-4" /> Provider home
    </Link>
  );

  if (!provider) {
    return (
      <div>
        {backLink}
        <h1 className="mt-3 text-2xl font-bold text-text">Rates, clients &amp; inspections</h1>
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-text-secondary">
            Complete your service provider profile first.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (provider.category !== 'property_management') {
    return (
      <div>
        {backLink}
        <h1 className="mt-3 text-2xl font-bold text-text">Rates, clients &amp; inspections</h1>
        <Card className="mt-4">
          <CardContent className="flex items-start gap-4 py-8">
            <Home className="h-6 w-6 shrink-0 text-text-secondary" />
            <div>
              <p className="font-bold text-text">This page is for Property Management accounts</p>
              <p className="mt-1 text-sm text-text-secondary">
                Your account is registered under &ldquo;{provider.category}&rdquo;. Rate/inspection
                management is specific to the Property Management category — if that&rsquo;s a mistake,
                update your category on your provider profile.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileRow = await prisma.propertyManagementProfile.findUnique({ where: { providerId: provider.id } });
  const profile = profileRow
    ? {
        monthlyFee: profileRow.monthlyFee?.toString() ?? null,
        quarterlyFee: profileRow.quarterlyFee?.toString() ?? null,
        biannualFee: profileRow.biannualFee?.toString() ?? null,
      }
    : null;

  return (
    <div>
      {backLink}
      <h1 className="mt-3 text-2xl font-bold text-text">Rates, clients &amp; inspections</h1>
      <p className="mt-1 text-text-secondary">Set your rates and submit inspection reports for your own clients.</p>
      <PropertyManagementSelfService initialProfile={profile} />
    </div>
  );
}
