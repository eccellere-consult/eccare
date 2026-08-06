import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Called when the elder/family dismisses the Razorpay Checkout overlay without
 *  paying — cleans up the 'pending' Order row the checkout flow has to create
 *  upfront (see POST /api/v1/orders) instead of leaving it to sit forever as an
 *  orphaned unpaid row. Only valid from 'pending' — a real paid/confirmed order was
 *  never actually a no-op checkout attempt and must go through a real refund/return
 *  process instead, not this route. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return fail('NOT_FOUND', 'Order not found.', 404);
  if (!(await canAccessElder(auth.userId, order.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this order.", 403);
  }

  if (order.status !== 'pending') {
    // Already resolved one way or another (paid via the handler, or already
    // cancelled) — nothing to do, and definitely nothing to silently overwrite.
    return NextResponse.json({ success: true, data: order });
  }

  const updated = await prisma.order.update({ where: { id }, data: { status: 'cancelled' } });
  return NextResponse.json({ success: true, data: updated });
}
