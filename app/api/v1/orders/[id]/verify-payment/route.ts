import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { verifyPaymentSignature } from '@/lib/razorpay';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Never trusts a client-side "payment succeeded" claim — re-verifies the HMAC
 *  signature server-side before ever marking an order paid. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return fail('NOT_FOUND', 'Order not found.', 404);
  if (!(await canAccessElder(auth.userId, order.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this order.", 403);
  }
  if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match the order.', 400);
  }
  if (order.status === 'paid' || order.status === 'confirmed') {
    return NextResponse.json({ success: true, data: order });
  }

  const valid = verifyPaymentSignature(
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId,
    parsed.data.razorpaySignature,
  );
  if (!valid) {
    return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'paid', razorpayPaymentId: parsed.data.razorpayPaymentId, paidAt: new Date() },
    include: { items: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
