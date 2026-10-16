import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ok } from '@/lib/community-route';
import { listJoinableCommunities } from '@/lib/community-options';

/** The registered communities a signed-in person can choose from when joining, instead of
 *  typing a code (see lib/community-options.ts). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }
  const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { pincode: true, city: true } });
  const rows = await listJoinableCommunities({
    q: req.nextUrl.searchParams.get('q') ?? '',
    me: { userId: auth.userId, pincode: me?.pincode ?? null, city: me?.city ?? null },
  });
  return ok(rows);
}
