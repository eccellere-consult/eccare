import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createRazorpayOrder } from '@/lib/razorpay';
import { resolveFamilyPrice } from '@/lib/family-subscription';

const schema = z.object({ billingCycle: z.enum(['monthly', 'annual']) });

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Starts a Razorpay order for the caller's own family subscription — same
 *  create-order-first-then-verify pattern as every other paid flow in this
 *  app (see POST /api/v1/orders). Works whether they're renewing after
 *  expiry or paying for the first time straight out of the trial; either way
 *  it's just "pay for one more period," not a distinct code path. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'caregiver') return fail('FORBIDDEN', 'Family members only.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please choose monthly or annual.', 400);

  const subscription = await prisma.familySubscription.findUnique({ where: { caregiverUserId: auth.userId } });
  if (!subscription) return fail('NOT_FOUND', 'No subscription found for your account.', 404);

  const price = await resolveFamilyPrice(parsed.data.billingCycle);

  try {
    const razorpayOrder = await createRazorpayOrder(price, `family-sub-${subscription.id}-${Date.now()}`);
    await prisma.familySubscription.update({
      where: { id: subscription.id },
      data: { billingCycle: parsed.data.billingCycle, razorpayOrderId: razorpayOrder.id },
    });

    return NextResponse.json(
      { success: true, data: { razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID } },
      { status: 201 },
    );
  } catch (err) {
    console.error('Family subscription order creation failed:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
