import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Platform admin: every partner enquiry, new ones first. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const enquiries = await prisma.partnerEnquiry.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  });
  return NextResponse.json({ success: true, data: enquiries });
}
