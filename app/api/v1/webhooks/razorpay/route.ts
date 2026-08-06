import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { getPlatformFeePercent, computePlatformFee } from '@/lib/platform-settings';

/** Reliability backstop for the client-side verify-payment call — covers cases like
 *  the browser closing right after a successful charge, before the client ever got
 *  to call back. Idempotent: only touches an order that isn't already paid. Always
 *  verifies against the RAW request body; a JSON.parse'd-then-reserialized copy
 *  would not match the signature. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Bad signature.' } }, { status: 400 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_BODY', message: 'Bad payload.' } }, { status: 400 });
  }

  if (event.event === 'payment.captured') {
    const razorpayOrderId = event.payload?.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload?.payment?.entity?.id;
    if (razorpayOrderId && razorpayPaymentId) {
      const order = await prisma.order.findUnique({ where: { razorpayOrderId } });
      if (order && order.status === 'pending') {
        const feePercent = await getPlatformFeePercent();
        const totalAmount = Number(order.totalAmount);
        const platformFeeAmount = computePlatformFee(totalAmount, feePercent);
        const netAmountForProvider = Math.round((totalAmount - platformFeeAmount) * 100) / 100;

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'paid', razorpayPaymentId, paidAt: new Date(), platformFeeAmount, netAmountForProvider },
        });
      }
    }
  }

  return NextResponse.json({ success: true, data: null });
}
