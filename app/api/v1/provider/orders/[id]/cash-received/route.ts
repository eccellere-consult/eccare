import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Cash on delivery: the shop confirms the delivery partner has handed over the money for the goods. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);
  const { id } = await params;

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  const job = await prisma.deliveryJob.findUnique({ where: { orderId: id }, include: { order: { select: { providerId: true } } } });
  if (!provider || !job || job.order.providerId !== provider.id) return fail('NOT_FOUND', 'Order not found.', 404);
  if (job.cashToShop === null) return fail('NOT_CASH', 'This order was paid online.', 409);
  if (job.status !== 'delivered') return fail('INVALID_STATE', 'The partner hands over the cash after the delivery.', 409);

  const updated = await prisma.deliveryJob.update({
    where: { id: job.id },
    data: { cashHandedToShopAt: job.cashHandedToShopAt ?? new Date() },
    select: { cashHandedToShopAt: true },
  });
  return NextResponse.json({ success: true, data: updated });
}
