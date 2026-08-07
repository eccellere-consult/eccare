import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** A transparency ledger, not a real accounting system: collected (paid FeeCharge
 *  rows) vs. spent (AssociationExpense rows), grouped by calendar month, with a
 *  running balance. Visible to every member — associations that hide the books
 *  invite exactly the kind of distrust this feature exists to prevent. Built from
 *  data already collected elsewhere (FeeCharge) rather than a parallel income
 *  ledger, so there's one source of truth for what was actually paid. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const [paidCharges, expenses] = await Promise.all([
    prisma.feeCharge.findMany({
      where: { communityFee: { neighborhoodId: guard.neighborhoodId }, status: 'paid', paidAt: { not: null } },
      select: { amount: true, paidAt: true },
    }),
    prisma.associationExpense.findMany({
      where: { neighborhoodId: guard.neighborhoodId },
      select: { amount: true, spentOn: true },
    }),
  ]);

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const collectedByMonth = new Map<string, number>();
  for (const c of paidCharges) {
    if (!c.paidAt) continue;
    const key = monthKey(c.paidAt);
    collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + Number(c.amount));
  }

  const spentByMonth = new Map<string, number>();
  for (const e of expenses) {
    const key = monthKey(e.spentOn);
    spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + Number(e.amount));
  }

  const months = Array.from(new Set([...collectedByMonth.keys(), ...spentByMonth.keys()])).sort();

  let runningBalance = 0;
  const ledger = months.map((month) => {
    const collected = Math.round((collectedByMonth.get(month) ?? 0) * 100) / 100;
    const spent = Math.round((spentByMonth.get(month) ?? 0) * 100) / 100;
    runningBalance = Math.round((runningBalance + collected - spent) * 100) / 100;
    return { month, collected, spent, balance: runningBalance };
  });

  const totalCollected = Math.round([...collectedByMonth.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const totalSpent = Math.round([...spentByMonth.values()].reduce((a, b) => a + b, 0) * 100) / 100;

  return ok({ ledger, totalCollected, totalSpent, currentBalance: runningBalance });
}
