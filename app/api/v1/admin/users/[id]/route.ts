import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Platform-admin-only, and deliberately hard to reach by accident — a User
 *  delete cascades to everything (medications, health records, family
 *  relations, SOS history, memories, orders, community posts...). Built
 *  specifically for the resident bulk-import flow's "duplicate — delete the
 *  stale existing account to make room for the fresh import" case, not as a
 *  general-purpose user management tool. Requires the caller to send back the
 *  exact name on file as confirmation (?confirmName=), so a client-side typo
 *  can't silently delete the wrong account. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only platform admins can do this.' } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } },
      { status: 404 },
    );
  }

  const confirmName = req.nextUrl.searchParams.get('confirmName') || '';
  if (confirmName.trim() !== user.name) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIRMATION_MISMATCH', message: "The typed name didn't match — nothing was deleted." } },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
