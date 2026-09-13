import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { verifyPaymentSignature } from '@/lib/razorpay';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);
  if (!(await canAccessElder(auth.userId, consultation.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this consultation.", 403);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  if (consultation.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match the consultation.', 400);
  }
  if (consultation.paidAt) return NextResponse.json({ success: true, data: consultation });

  const valid = verifyPaymentSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
  if (!valid) return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);

  const updated = await prisma.consultationRequest.update({
    where: { id },
    data: { razorpayPaymentId: parsed.data.razorpayPaymentId, paidAt: new Date() },
  });

  return NextResponse.json({ success: true, data: updated });
}
