import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createRazorpayOrder, verifyPaymentSignature } from '@/lib/razorpay';
import { isFeatureOn } from '@/lib/feature-switches';
import { missingBeforePay } from '@/lib/campaigns';
import { fail, providerFor, serialiseCampaign } from '@/lib/campaigns-server';

async function ownDraft(userId: string, id: string) {
  const provider = await providerFor(userId);
  if (!provider) return null;
  const campaign = await prisma.campaign.findFirst({ where: { id, providerId: provider.id } });
  return campaign ? { provider, campaign } : null;
}

/** Starts payment for an offer or ad (Razorpay). Only a verified provider can pay. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const own = await ownDraft(auth.userId, id);
  if (!own) return fail('NOT_FOUND', 'Not found.', 404);
  const { provider, campaign } = own;
  if (!(await isFeatureOn('offers'))) return fail('NOT_OPEN', 'Offers and ads are not open yet.');
  if (provider.verificationStatus !== 'verified') return fail('NOT_VERIFIED', 'EC must approve your provider account before you can advertise.');
  if (campaign.status !== 'draft') return fail('BAD_STATE', 'This one is already paid for.');
  const missing = missingBeforePay(campaign);
  if (missing.length) return fail('INCOMPLETE', `Still needed: ${missing.join('; ')}.`);

  try {
    const order = await createRazorpayOrder(Number(campaign.price), `campaign-${campaign.id}`);
    await prisma.campaign.update({ where: { id }, data: { razorpayOrderId: order.id } });
    return NextResponse.json({
      success: true,
      data: { razorpayOrderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for campaign:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}

const verifySchema = z.object({ razorpayPaymentId: z.string(), razorpayOrderId: z.string(), razorpaySignature: z.string() });

/** Confirms the payment (signature checked on the server) and sends the offer to EC for approval. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const own = await ownDraft(auth.userId, id);
  if (!own) return fail('NOT_FOUND', 'Not found.', 404);
  const { campaign } = own;

  const parsed = verifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.');
  const p = parsed.data;
  if (campaign.razorpayOrderId !== p.razorpayOrderId) return fail('MISMATCH', 'This payment does not match this offer.');
  if (!verifyPaymentSignature(p.razorpayOrderId, p.razorpayPaymentId, p.razorpaySignature)) {
    return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact EC.');
  }

  // Only a draft moves on, so a repeated confirmation changes nothing.
  await prisma.campaign.updateMany({
    where: { id, status: 'draft' },
    data: { status: 'in_review', paidAt: new Date(), razorpayPaymentId: p.razorpayPaymentId },
  });
  const updated = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { enquiries: { orderBy: { createdAt: 'desc' }, take: 100 } },
  });
  return NextResponse.json({ success: true, data: serialiseCampaign(updated) });
}
