import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

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

  return NextResponse.json({ success: true, data: invites });
}
