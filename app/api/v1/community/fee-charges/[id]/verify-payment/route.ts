import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { getPlatformFeePercent, computePlatformFee } from '@/lib/platform-settings';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Same pattern as POST /api/v1/orders/[id]/verify-payment — never trusts a
 *  client-side "payment succeeded" claim, re-verifies the HMAC signature
 *  server-side before ever marking a charge paid. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  const charge = await prisma.feeCharge.findUnique({ where: { id } });
  if (!charge) return fail('NOT_FOUND', 'Charge not found.', 404);
  if (!(await canAccessElder(auth.userId, charge.residentUserId))) {
    return fail('FORBIDDEN', "You don't have access to this charge.", 403);
  }
  if (charge.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match the charge.', 400);
  }
  if (charge.status === 'paid') {
    return NextResponse.json({ success: true, data: charge });
  }

  const valid = verifyPaymentSignature(
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId,
    parsed.data.razorpaySignature,
  );
  if (!valid) {
    return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);
  }

  const feePercent = await getPlatformFeePercent();
  const amount = Number(charge.amount);
  const platformFeeAmount = computePlatformFee(amount, feePercent);
  const netAmountForAssociation = Math.round((amount - platformFeeAmount) * 100) / 100;

  const updated = await prisma.feeCharge.update({
    where: { id },
    data: {
      status: 'paid',
      razorpayPaymentId: parsed.data.razorpayPaymentId,
      paidAt: new Date(),
      paidByUserId: auth.userId,
      platformFeeAmount,
      netAmountForAssociation,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
