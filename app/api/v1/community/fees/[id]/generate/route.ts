import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { todayIST } from '@/lib/medicine-slots';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Fee not found.' } }, { status: 404 });

const DUE_IN_DAYS = 10;

/** Issues this cycle's bills — one FeeCharge per current member of the community,
 *  for the current period. A deliberate committee click, not automatic (see the
 *  CommunityFee model comment for why) — safe to click more than once: the unique
 *  (communityFeeId, neighborhoodMemberId, period) constraint means an already-
 *  billed member/period is silently skipped via skipDuplicates, never double-billed. */
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
    select: { id: true, userId: true },
  });

  const dueDate = new Date(Date.now() + DUE_IN_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.feeCharge.createMany({
    data: members.map((m) => ({
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
    chargesCreated: result.count,
    alreadyBilled: members.length - result.count,
  });
}
