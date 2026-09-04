import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Every consultation request platform-wide — the elder-scoped
 *  GET /api/v1/advisory/consultations only ever returns one elder's own
 *  requests (defaults to the caller), which is useless for an admin
 *  coordinating requests across everyone. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  if (auth.role !== 'admin') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 });

  const consultations = await prisma.consultationRequest.findMany({
    include: {
      assignedExpert: true,
      elderUser: { select: { id: true, name: true, phone: true } },
      requestedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, data: consultations });
}
