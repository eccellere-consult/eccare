import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 403) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Platform-admin-only. Safe fields only — never select passwordHash/pinHash
 *  here, same rule as every other route that lists users (see toSafeUser's
 *  own comment for the history of this being violated and fixed elsewhere).
 *  Used by the bulk-invite tool, which needs the full base rather than the
 *  admin Users page's own recent-100 glance cap. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') return fail('FORBIDDEN', 'Only platform admins can do this.');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: { id: true, name: true, phone: true, email: true, role: true },
  });

  return NextResponse.json({ success: true, data: users });
}
