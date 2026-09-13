import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Self-serve "who pays this flat's community fees" — the elder or the family
 *  caregiver can set either side as the flat's billing contact (canAccessElder
 *  covers both directions, same as every other elder-scoped route). Claiming the
 *  flag clears it on every other member of the same flatNumber in one
 *  transaction, so exactly one member per flat carries it. Takes effect from the
 *  next billing cycle's `generate` call onward — like CommunityFee.defaultAmount,
 *  charges already issued keep whoever they were issued to. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return fail('NOT_FOUND', 'Member not found.', 404);

  if (!(await canAccessElder(auth.userId, target.userId))) {
    return fail('FORBIDDEN', "You don't have access to set this.", 403);
  }

  if (!target.flatNumber) {
    return fail('NO_FLAT_NUMBER', 'This member has no flat/house number set yet — ask the committee to add one first.', 400);
  }

  await prisma.$transaction([
    prisma.neighborhoodMember.updateMany({
      where: { neighborhoodId: target.neighborhoodId, flatNumber: target.flatNumber },
      data: { isBillingContact: false },
    }),
    prisma.neighborhoodMember.update({
      where: { id: target.id },
      data: { isBillingContact: true },
    }),
  ]);

  return NextResponse.json({ success: true, data: { billingContactMemberId: target.id } });
}
