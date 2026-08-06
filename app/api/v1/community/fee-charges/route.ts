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
 *  view and pay. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this resident's fees.", 403);
  }

  const charges = await prisma.feeCharge.findMany({
    where: { residentUserId: elderUserId },
    include: {
      communityFee: { select: { label: true } },
      neighborhoodMember: { select: { flatNumber: true } },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  });

  return NextResponse.json({ success: true, data: charges });
}
