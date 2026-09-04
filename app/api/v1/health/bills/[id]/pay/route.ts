import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess } from '@/lib/health-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Same pattern as fee-charges/[id]/pay and doctor-bookings/[id]/pay — creates
 *  the Razorpay order at the moment of tapping Pay, no stored balance. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.billPayment.findUnique({ where: { id }, include: { linkedBiller: true } });
  if (!bill) return fail('NOT_FOUND', 'Bill not found.', 404);

  const guard = await requireHealthAccess(req, bill.linkedBiller.elderUserId);
  if (guard instanceof Response) return guard;

  if (bill.status !== 'due') return fail('NOT_PAYABLE', 'This bill is already paid.', 400);

  try {
    const razorpayOrder = await createRazorpayOrder(Number(bill.amount), bill.id);
    await prisma.billPayment.update({ where: { id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: { billId: bill.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for bill payment:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
