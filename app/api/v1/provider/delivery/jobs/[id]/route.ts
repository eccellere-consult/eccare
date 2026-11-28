import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { deliveryFail, requirePartner } from '@/lib/delivery-partner-access';
import { loadDispatchCandidates, notifyCustomer, settleDeliveredJob } from '@/lib/delivery-jobs';
import { MAX_ACTIVE_JOBS } from '@/lib/delivery-pricing';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('release') }),
  z.object({ action: z.literal('picked_up') }),
  z.object({ action: z.literal('delivered'), code: z.string().trim().regex(/^\d{4}$/, 'Ask the customer for the 4-digit code.') }),
]);

/** A delivery partner moves a delivery along: accept it, give it back, picked up, delivered. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, partnerId, provider } = await requirePartner(req);
  if (error) return error;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return deliveryFail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please try again.');
  const action = parsed.data.action;

  if (action === 'accept') {
    if (provider.verificationStatus !== 'verified') {
      return deliveryFail('NOT_APPROVED', 'EC has not approved your account yet.', 403);
    }
    const me = (await loadDispatchCandidates()).find((c) => c.id === partnerId);
    if (me && me.activeJobs >= MAX_ACTIVE_JOBS) {
      return deliveryFail('TOO_MANY', `Finish one of your ${MAX_ACTIVE_JOBS} deliveries first.`, 409);
    }
    // First to accept wins: only an open delivery with nobody on it can be taken.
    const taken = await prisma.deliveryJob.updateMany({
      where: { id, status: 'open', partnerId: null },
      data: { status: 'accepted', partnerId, acceptedAt: new Date() },
    });
    if (taken.count === 0) return deliveryFail('GONE', 'Someone else has already taken this delivery.', 409);
    const job = await prisma.deliveryJob.findUnique({ where: { id }, select: { orderId: true } });
    if (job) await notifyCustomer(job.orderId, 'A delivery partner is on the way', 'They will pick up your order from the shop soon.');
    return NextResponse.json({ success: true, data: { id, status: 'accepted' } });
  }

  const job = await prisma.deliveryJob.findUnique({ where: { id } });
  if (!job || job.partnerId !== partnerId) return deliveryFail('NOT_FOUND', 'This delivery is not one of yours.', 404);

  if (action === 'release') {
    if (job.status !== 'accepted') return deliveryFail('INVALID_STATE', 'You can only give back a delivery before you pick it up.', 409);
    await prisma.deliveryJob.update({ where: { id }, data: { status: 'open', partnerId: null, acceptedAt: null } });
    return NextResponse.json({ success: true, data: { id, status: 'open' } });
  }

  if (action === 'picked_up') {
    if (job.status !== 'accepted') return deliveryFail('INVALID_STATE', 'Accept the delivery first.', 409);
    await prisma.deliveryJob.update({ where: { id }, data: { status: 'picked_up', pickedUpAt: new Date() } });
    await notifyCustomer(job.orderId, 'Your order is on its way', 'The delivery partner has picked it up from the shop.');
    return NextResponse.json({ success: true, data: { id, status: 'picked_up' } });
  }

  // delivered
  if (job.status !== 'picked_up') return deliveryFail('INVALID_STATE', 'Mark it picked up first.', 409);
  if (parsed.data.action === 'delivered' && parsed.data.code !== job.handoverCode) {
    return deliveryFail('WRONG_CODE', 'That code does not match. Ask the customer to read it from their EC orders page.', 400);
  }
  await prisma.$transaction([
    prisma.deliveryJob.update({ where: { id }, data: { status: 'delivered', deliveredAt: new Date() } }),
    prisma.order.updateMany({ where: { id: job.orderId, status: 'confirmed' }, data: { status: 'delivered' } }),
  ]);
  await settleDeliveredJob(id);
  await notifyCustomer(job.orderId, 'Your order was delivered', 'Please rate the delivery in EC.');
  return NextResponse.json({ success: true, data: { id, status: 'delivered' } });
}
