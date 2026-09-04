import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Every active property subscription platform-wide — what the admin (acting
 *  on the field agent's behalf) picks from to submit an inspection against. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  if (auth.role !== 'admin') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 });

  const subscriptions = await prisma.propertySubscription.findMany({
    where: { status: 'active' },
    include: { elderUser: { select: { id: true, name: true, address: true, city: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: subscriptions });
}
