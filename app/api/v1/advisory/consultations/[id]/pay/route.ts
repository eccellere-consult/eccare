import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Same create-pending-order pattern as property-invoices/[id]/pay — only
 *  payable once an expert is assigned and has a consultationFee set (a free
 *  consultation, or one not yet assigned an expert, has nothing to pay). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({
    where: { id },
    include: { assignedExpert: true },
  });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);
  if (!(await canAccessElder(auth.userId, consultation.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this consultation.", 403);
  }
  if (consultation.paidAt) return fail('ALREADY_PAID', 'This consultation has already been paid.', 400);
  if (!consultation.assignedExpert?.consultationFee) {
    return fail('NOT_PAYABLE', 'No consultation fee has been set for this request yet.', 400);
  }

  try {
    const amount = Number(consultation.assignedExpert.consultationFee);
    const razorpayOrder = await createRazorpayOrder(amount, consultation.id);
    await prisma.consultationRequest.update({ where: { id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: { consultationId: consultation.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for consultation:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
