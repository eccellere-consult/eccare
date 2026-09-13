import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A resident's own "what do I owe" view — the elder/family-facing counterpart to
 *  the committee's GET /api/v1/community/fees/[id]/charges (which sees everyone's
 *  bills). Same elderUserId/canAccessElder pattern as Order and every other
 *  elder-scoped resource — either the elder themself or a linked caregiver can
 *  view and pay.
 *
 *  Also resolves the resident's household (same neighborhood + flatNumber) and
 *  returns every housemate's charges too — read-only for whichever side isn't
 *  the flat's designated billing contact, so a shared flat's bill is settled
 *  once and simply visible (not payable) to the other party, per
 *  NeighborhoodMember.isBillingContact. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this resident's fees.", 403);
  }

  const myMembership = await prisma.neighborhoodMember.findFirst({
    where: { userId: elderUserId, flatNumber: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  let household: {
    flatNumber: string;
    myMembershipId: string;
    payerUserId: string;
    payerName: string;
    isMePayer: boolean;
    memberCount: number;
  } | null = null;
  let neighborhoodMemberIds: string[] = [];

  if (myMembership) {
    const siblings = await prisma.neighborhoodMember.findMany({
      where: { neighborhoodId: myMembership.neighborhoodId, flatNumber: myMembership.flatNumber },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } },
    });
    const payer = siblings.find((m) => m.isBillingContact) ?? siblings[0];
    household = {
      flatNumber: myMembership.flatNumber!,
      myMembershipId: myMembership.id,
      payerUserId: payer.userId,
      payerName: payer.user.name,
      isMePayer: payer.userId === elderUserId,
      memberCount: siblings.length,
    };
    neighborhoodMemberIds = siblings.map((m) => m.id);
  }

  const charges = await prisma.feeCharge.findMany({
    where: neighborhoodMemberIds.length > 0
      ? { OR: [{ residentUserId: elderUserId }, { neighborhoodMemberId: { in: neighborhoodMemberIds } }] }
      : { residentUserId: elderUserId },
    include: {
      communityFee: { select: { label: true } },
      neighborhoodMember: { select: { flatNumber: true } },
      resident: { select: { name: true } },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  });

  const data = charges.map((c) => ({ ...c, payable: c.residentUserId === elderUserId }));

  return NextResponse.json({ success: true, data: { household, charges: data } });
}
