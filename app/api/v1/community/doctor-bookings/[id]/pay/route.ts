import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Same pattern as fee-charges/[id]/pay: creates the Razorpay order at the
 *  moment the booker actually taps "Pay", not when the booking was made. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const booking = await prisma.doctorBooking.findUnique({ where: { id } });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.bookedById !== auth.userId) return fail('FORBIDDEN', "This isn't your booking.", 403);
  if (booking.status !== 'confirmed') {
    return fail('NOT_PAYABLE', 'This booking needs to be confirmed by the clinic before paying.', 400);
  }

  try {
    const razorpayOrder = await createRazorpayOrder(Number(booking.amount), booking.id);
    await prisma.doctorBooking.update({ where: { id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: { bookingId: booking.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for doctor booking:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
