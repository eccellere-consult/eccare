import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess } from '@/lib/health-access';
import { verifyPaymentSignature } from '@/lib/razorpay';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.billPayment.findUnique({ where: { id }, include: { linkedBiller: true } });
  if (!bill) return fail('NOT_FOUND', 'Bill not found.', 404);

  const guard = await requireHealthAccess(req, bill.linkedBiller.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  if (bill.razorpayOrderId !== parsed.data.razorpayOrderId) return fail('MISMATCH', 'This payment does not match the bill.', 400);
  if (bill.status === 'paid') return NextResponse.json({ success: true, data: bill });

  const valid = verifyPaymentSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
  if (!valid) return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);

  const updated = await prisma.billPayment.update({
    where: { id },
    data: { status: 'paid', razorpayPaymentId: parsed.data.razorpayPaymentId, paidAt: new Date() },
  });

  return NextResponse.json({ success: true, data: updated });
}
