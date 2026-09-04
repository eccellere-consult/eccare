import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess } from '@/lib/health-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.propertyInvoice.findUnique({
    where: { id },
    include: { repairEstimate: { include: { inspection: { include: { subscription: true } } } } },
  });
  if (!invoice) return fail('NOT_FOUND', 'Invoice not found.', 404);

  const guard = await requireHealthAccess(req, invoice.repairEstimate.inspection.subscription.elderUserId);
  if (guard instanceof Response) return guard;

  if (invoice.status !== 'pending') return fail('NOT_PAYABLE', 'This invoice is already paid.', 400);

  try {
    const razorpayOrder = await createRazorpayOrder(Number(invoice.amount), invoice.id);
    await prisma.propertyInvoice.update({ where: { id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: { invoiceId: invoice.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for property invoice:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
