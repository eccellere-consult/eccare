import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { verifyPaymentSignature } from '@/lib/razorpay';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Same pattern as fee-charges/[id]/verify-payment and orders/[id]/verify-payment
 *  — never trusts a client-side "payment succeeded" claim. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  const booking = await prisma.doctorBooking.findUnique({ where: { id } });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.bookedById !== auth.userId) return fail('FORBIDDEN', "This isn't your booking.", 403);
  if (booking.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match the booking.', 400);
  }
  if (booking.status === 'paid') {
    return NextResponse.json({ success: true, data: booking });
  }

  const valid = verifyPaymentSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
  if (!valid) return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);

  const updated = await prisma.doctorBooking.update({
    where: { id },
    data: { status: 'paid', razorpayPaymentId: parsed.data.razorpayPaymentId },
  });

  return NextResponse.json({ success: true, data: updated });
}
