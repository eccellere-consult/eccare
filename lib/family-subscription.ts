import { prisma } from '@/lib/db';
import { getPricingContent } from '@/lib/pricing-content';

export type EffectiveFamilySubscriptionStatus = 'trialing' | 'active' | 'expired';

export interface FamilySubscriptionState {
  /** False when the caregiver has no FamilySubscription row at all — a real
   *  account created before this feature shipped, or a community-application
   *  claim (see CommunityApplication). Both are grandfathered/exempt entirely,
   *  never blocked, by virtue of never having a row. */
  exists: boolean;
  /** Recomputed against trialEndsAt/currentPeriodEnd right now, not trusted
   *  from the stored `status` column alone — same read-time-expiry convention
   *  as ServiceProvider.isFeatured, since this app has no cron to flip a
   *  status column the moment a deadline passes. */
  status: EffectiveFamilySubscriptionStatus;
  blocked: boolean;
  billingCycle: 'monthly' | 'annual';
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

/** Reads a caregiver's subscription state read-time — see FamilySubscriptionState's
 *  own doc comment for why "no row" and "expired" are different things. */
export async function getFamilySubscriptionState(caregiverUserId: string): Promise<FamilySubscriptionState> {
  const row = await prisma.familySubscription.findUnique({ where: { caregiverUserId } });
  if (!row) {
    return { exists: false, status: 'active', blocked: false, billingCycle: 'monthly', trialEndsAt: null, currentPeriodEnd: null };
  }

  const now = new Date();
  let status: EffectiveFamilySubscriptionStatus = row.status;
  if (row.status === 'trialing' && row.trialEndsAt < now) status = 'expired';
  if (row.status === 'active' && row.currentPeriodEnd && row.currentPeriodEnd < now) status = 'expired';

  return {
    exists: true,
    status,
    blocked: status === 'expired',
    billingCycle: row.billingCycle,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

export async function resolveFamilyPrice(billingCycle: 'monthly' | 'annual'): Promise<number> {
  const content = await getPricingContent();
  return billingCycle === 'annual' ? content.familyAnnualPrice : content.familyMonthlyPrice;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function periodLengthMs(billingCycle: 'monthly' | 'annual'): number {
  return billingCycle === 'annual' ? 365 * DAY_MS : 30 * DAY_MS;
}
