import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const invites = await prisma.familyRelation.findMany({
    where: { elderUserId: auth.userId, inviteStatus: 'pending' },
    include: { caregiverUser: true },
    orderBy: { createdAt: 'desc' },
  });

  const safeInvites = invites.map((i) => ({ ...i, caregiverUser: toSafeUser(i.caregiverUser) }));
  return NextResponse.json({ success: true, data: safeInvites });
}
