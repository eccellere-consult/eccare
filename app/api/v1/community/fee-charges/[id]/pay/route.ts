import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Creates the Razorpay order for one specific charge, at the moment the resident
 *  actually taps "Pay" — not when the committee generates the charge. Generating a
 *  cycle's charges can mean dozens of rows at once; creating a live Razorpay order
 *  for every one of them immediately, most of which may go unpaid for days, would
 *  be needless noise on the Razorpay side for no benefit (same reasoning as why
 *  Order's razorpayOrderId is created at checkout time, not at cart-add time). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const charge = await prisma.feeCharge.findUnique({ where: { id } });
  if (!charge) return fail('NOT_FOUND', 'Charge not found.', 404);

  if (!(await canAccessElder(auth.userId, charge.residentUserId))) {
    return fail('FORBIDDEN', "You don't have access to pay this charge.", 403);
  }
  if (charge.status !== 'due') {
    return fail('NOT_PAYABLE', `This charge is already ${charge.status}.`, 400);
  }

  try {
    const razorpayOrder = await createRazorpayOrder(Number(charge.amount), charge.id);
    await prisma.feeCharge.update({ where: { id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: {
        chargeId: charge.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for fee charge:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
