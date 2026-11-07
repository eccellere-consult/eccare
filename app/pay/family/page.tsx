import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { verifyPayToken } from '@/lib/family-pay-link';
import { getFamilySubscriptionState, resolveFamilyPrice } from '@/lib/family-subscription';
import { FamilyPayClient } from './pay-client';

export const metadata: Metadata = {
  title: 'Family plan — EC',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/** The page behind the private link we email / WhatsApp to a family member.
 *  Opens in the phone's browser, not in the Android app, and needs no sign-in:
 *  the signed link itself proves who is paying (and only lets them pay). */
export default async function FamilyPayPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const caregiverUserId = await verifyPayToken(t);

  if (!caregiverUserId) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-text">This link has expired</h1>
        <p className="mt-2 text-text-secondary">
          Open the EC app and ask for the details again, or sign in at{' '}
          <Link href="/login" className="font-semibold text-primary-600 underline">eccare.in</Link> to pay there.
        </p>
      </Shell>
    );
  }

  const [user, state, monthly, annual] = await Promise.all([
    prisma.user.findUnique({ where: { id: caregiverUserId }, select: { name: true, role: true } }),
    getFamilySubscriptionState(caregiverUserId),
    resolveFamilyPrice('monthly'),
    resolveFamilyPrice('annual'),
  ]);

  if (!user || user.role !== 'caregiver' || !state.exists) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-text">Nothing to pay here</h1>
        <p className="mt-2 text-text-secondary">We could not find a family plan for this link.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <FamilyPayClient
        token={t!}
        name={user.name ?? ''}
        status={state.status}
        trialEndsAt={state.trialEndsAt ? state.trialEndsAt.toISOString() : null}
        currentPeriodEnd={state.currentPeriodEnd ? state.currentPeriodEnd.toISOString() : null}
        monthlyPrice={monthly}
        annualPrice={annual}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <p className="mb-4 text-sm font-semibold tracking-wide text-primary-700">EC — Just Easy.</p>
        {children}
      </div>
    </div>
  );
}
