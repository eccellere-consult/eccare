import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A provider's own incoming orders. Only paid/confirmed orders are shown by
 *  default — a `pending` (payment not yet completed) order isn't a real
 *  commitment yet. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const orders = await prisma.order.findMany({
    where: { providerId: provider.id, status: { in: ['paid', 'confirmed', 'cancelled'] } },
    include: { items: true, elderUser: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: orders });
}
