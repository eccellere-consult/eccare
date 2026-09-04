import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

const STATUSES = ['pending', 'verified', 'rejected'] as const;

/** Every volunteer registration, newest first — pending shown first so the queue
 *  reads naturally, same ordering as the provider verification queue. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status');
  const where = status && (STATUSES as readonly string[]).includes(status) ? { verificationStatus: status as (typeof STATUSES)[number] } : {};

  const volunteers = await prisma.volunteerProfile.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, data: volunteers });
}
