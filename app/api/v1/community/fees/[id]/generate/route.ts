import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { todayIST } from '@/lib/medicine-slots';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Fee not found.' } }, { status: 404 });

const DUE_IN_DAYS = 10;

/** Issues this cycle's bills — one FeeCharge per HOUSEHOLD (flatNumber) in the
 *  community, for the current period, not one per member row. Members sharing a
 *  flatNumber (e.g. an elder and their caregiver, both separately registered as
 *  NeighborhoodMember of the same flat) are grouped and billed once, to the
 *  flat's designated billing contact (NeighborhoodMember.isBillingContact — see
 *  its schema comment) or, absent one, whoever joined that flat earliest, kept
 *  stable across cycles. Members with no flatNumber set are still billed
 *  individually — there's no household to group them into. A deliberate
 *  committee click, not automatic (see the CommunityFee model comment for why)
 *  — safe to click more than once: the unique (communityFeeId,
 *  neighborhoodMemberId, period) constraint means an already-billed
 *  household/period is silently skipped via skipDuplicates, never double-billed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fee = await prisma.communityFee.findUnique({ where: { id } });
  if (!fee) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: fee.neighborhoodId });
  if (guard.error) return guard.error;

  if (!fee.isActive) {
    return NextResponse.json(
      { success: false, error: { code: 'INACTIVE', message: 'This fee is turned off — reactivate it before generating charges.' } },
      { status: 400 },
    );
  }

  const period = fee.frequency === 'monthly' ? todayIST().slice(0, 7) : 'one-time';

  const members = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: fee.neighborhoodId },
    select: { id: true, userId: true, flatNumber: true, isBillingContact: true },
    orderBy: { createdAt: 'asc' },
  });

  const households = new Map<string, typeof members>();
  for (const m of members) {
    const key = m.flatNumber ? `flat:${m.flatNumber}` : `member:${m.id}`;
    const group = households.get(key);
    if (group) group.push(m);
    else households.set(key, [m]);
  }

  // Each group is already ordered by createdAt asc (from the query above), so
  // group[0] is a stable "earliest joined" fallback when nobody in the flat has
  // explicitly claimed billing.
  const payers = Array.from(households.values()).map((group) => group.find((m) => m.isBillingContact) ?? group[0]);

  const dueDate = new Date(Date.now() + DUE_IN_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.feeCharge.createMany({
    data: payers.map((m) => ({
      communityFeeId: fee.id,
      neighborhoodMemberId: m.id,
      residentUserId: m.userId,
      period,
      amount: fee.defaultAmount,
      dueDate,
    })),
    skipDuplicates: true,
  });

  return ok({
    period,
    membersConsidered: members.length,
    householdsBilled: payers.length,
    chargesCreated: result.count,
    alreadyBilled: payers.length - result.count,
  });
}
