import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { resolveFamilyPrice, periodLengthMs } from '@/lib/family-subscription';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please try again.', 400);

  const subscription = await prisma.familySubscription.findUnique({ where: { caregiverUserId: auth.userId } });
  if (!subscription) return fail('NOT_FOUND', 'No subscription found for your account.', 404);
  if (subscription.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match your current order.', 400);
  }

  // Idempotent — a second call for an already-paid period (e.g. a retried
  // client request) just returns the current state rather than re-extending.
  if (subscription.status === 'active' && subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()) {
    return NextResponse.json({ success: true, data: subscription });
  }

  const valid = verifyPaymentSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
  if (!valid) return fail('INVALID_SIGNATURE', 'Payment verification failed.', 400);

  const price = await resolveFamilyPrice(subscription.billingCycle);
  // Extends from whichever is later of now or an existing (not-yet-lapsed)
  // period end — same stacking convention as the featured-ad renewal.
  const base = subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date();
  const currentPeriodEnd = new Date(base.getTime() + periodLengthMs(subscription.billingCycle));

  const updated = await prisma.familySubscription.update({
    where: { id: subscription.id },
    data: {
      status: 'active',
      currentPeriodEnd,
      razorpayPaymentId: parsed.data.razorpayPaymentId,
      paidAt: new Date(),
      amountPaid: price,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
