import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { cancelAndRefund, settleDeliveredJob } from '@/lib/delivery-jobs';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.discriminatedUnion('action', [
  // Paid the partner by UPI outside EC; ref = the UPI transaction number.
  z.object({ action: z.literal('mark_paid'), ref: z.string().trim().min(3).max(80) }),
  // Try the automatic Route payout again (after Route was switched on or a linked account added).
  z.object({ action: z.literal('retry_route') }),
  z.object({ action: z.literal('cancel_refund'), reason: z.string().trim().min(3).max(300) }),
]);

/** Admin actions on one delivery: mark the partner paid, retry the Route payout, cancel and refund. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check and try again.');

  const job = await prisma.deliveryJob.findUnique({ where: { id }, select: { status: true, payoutStatus: true } });
  if (!job) return fail('NOT_FOUND', 'Delivery not found.', 404);

  if (parsed.data.action === 'mark_paid') {
    if (job.status !== 'delivered' || job.payoutStatus !== 'unpaid') return fail('INVALID_STATE', 'Only a finished, unpaid delivery can be marked paid.', 409);
    await prisma.deliveryJob.update({ where: { id }, data: { payoutStatus: 'paid', payoutRef: parsed.data.ref, paidOutAt: new Date() } });
    return NextResponse.json({ success: true, data: { id } });
  }

  if (parsed.data.action === 'retry_route') {
    await settleDeliveredJob(id);
    const after = await prisma.deliveryJob.findUnique({ where: { id }, select: { payoutStatus: true } });
    if (after?.payoutStatus !== 'transferred') {
      return fail('NOT_SENT', 'Not sent. Check that Route payouts are On and the partner has a linked account ID.', 409);
    }
    return NextResponse.json({ success: true, data: { id } });
  }

  try {
    const result = await cancelAndRefund(id, parsed.data.reason);
    return NextResponse.json({ success: true, data: { id, ...result } });
  } catch (err) {
    return fail('REFUND_FAILED', err instanceof Error ? err.message : 'Could not cancel.', 409);
  }
}
