import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Platform admin: list every community registration application, newest first,
 *  with pending ones surfaced ahead of decided ones — same ordering convention
 *  as GET /api/v1/admin/providers. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const status = req.nextUrl.searchParams.get('status');

  const applications = await prisma.communityApplication.findMany({
    where: status ? { status: status as 'pending' | 'approved' | 'rejected' } : undefined,
    include: { documents: true, neighborhood: { select: { id: true, name: true, joinCode: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, data: applications });
}
