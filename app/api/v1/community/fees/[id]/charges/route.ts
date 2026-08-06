import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Fee not found.' } }, { status: 404 });

/** Committee's own view of a fee's billing — every charge regardless of resident,
 *  so they can see who's paid and who hasn't. Contrast with GET
 *  /api/v1/community/fee-charges, which is the resident's own "what do I owe" view,
 *  scoped to just their household. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fee = await prisma.communityFee.findUnique({ where: { id } });
  if (!fee) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: fee.neighborhoodId });
  if (guard.error) return guard.error;

  const charges = await prisma.feeCharge.findMany({
    where: { communityFeeId: id },
    include: {
      resident: { select: { name: true } },
      neighborhoodMember: { select: { flatNumber: true } },
    },
    orderBy: [{ period: 'desc' }, { createdAt: 'asc' }],
  });

  return ok(charges);
}
