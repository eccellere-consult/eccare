import { prisma } from '@/lib/db';

const SINGLETON_ID = 'singleton';

/** Reads the current platform commission rate — creates the singleton row with the
 *  schema default (5%) on first read if it somehow doesn't exist yet (e.g. a fresh
 *  environment that skipped the seed insert), so callers never have to null-check. */
export async function getPlatformFeePercent(): Promise<number> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  return Number(settings.platformFeePercent);
}

export async function setPlatformFeePercent(percent: number, updatedById: string): Promise<number> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { platformFeePercent: percent, updatedById },
    create: { id: SINGLETON_ID, platformFeePercent: percent, updatedById },
  });
  return Number(settings.platformFeePercent);
}

/** Rounds to paise (2 decimal places) the same way every other money amount in this
 *  app is stored — computed once at payment time and snapshotted onto the paid
 *  Order/FeeCharge, never re-derived later so a rate change never rewrites history. */
export function computePlatformFee(totalAmount: number, feePercent: number): number {
  return Math.round(totalAmount * (feePercent / 100) * 100) / 100;
}
