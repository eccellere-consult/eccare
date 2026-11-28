import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { liveWindow } from '@/lib/campaigns';
import { fail, refundCampaignPayment, serialiseCampaign } from '@/lib/campaigns-server';

const schema = z.object({
  action: z.enum(['approve', 'reject', 'take_down']),
  note: z.string().trim().max(1000).optional(),
  // take_down only: also give the money back.
  refund: z.boolean().optional(),
});

/**
 * EC's decision on a paid offer or ad.
 *  - approve: it shows from now for the days paid for.
 *  - reject: it never shows and the payment is refunded in full.
 *  - take_down: a showing one is removed (refund only if the admin ticks it).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Please choose what to do.');
  const { action, note, refund } = parsed.data;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return fail('NOT_FOUND', 'Not found.', 404);
  const now = new Date();
  const reviewed = { reviewedAt: now, reviewedById: auth.userId, adminNote: note || null };

  if (action === 'approve') {
    if (campaign.status !== 'in_review') return fail('BAD_STATE', 'Only a paid offer waiting for approval can be approved.');
    await prisma.campaign.update({ where: { id }, data: { ...reviewed, status: 'live', ...liveWindow(now, campaign.days) } });
  } else {
    if (!note) return fail('NOTE_NEEDED', 'Please write the reason; the provider sees it.');
    const allowed = action === 'reject' ? campaign.status === 'in_review' : campaign.status === 'live';
    if (!allowed) return fail('BAD_STATE', action === 'reject' ? 'Only one waiting for approval can be rejected.' : 'Only a showing one can be taken down.');
    const giveBack = action === 'reject' || refund === true;
    let refundId: string | null = null;
    if (giveBack && campaign.razorpayPaymentId && !campaign.refundId) {
      try {
        const r = await refundCampaignPayment(campaign.razorpayPaymentId, Number(campaign.price));
        refundId = r.id;
      } catch (err) {
        console.error('Campaign refund failed:', err instanceof Error ? err.message : err);
        return fail('REFUND_FAILED', 'Razorpay could not refund it just now, so nothing was changed. Please try again.', 502);
      }
    }
    await prisma.campaign.update({
      where: { id },
      data: {
        ...reviewed,
        status: action === 'reject' ? 'rejected' : 'taken_down',
        ...(action === 'take_down' ? { endsAt: now } : {}),
        ...(refundId ? { refundId, refundedAt: now } : {}),
      },
    });
  }

  const updated = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: {
      provider: { select: { businessName: true, phone: true, verificationStatus: true } },
      _count: { select: { enquiries: true } },
    },
  });
  return NextResponse.json({ success: true, data: serialiseCampaign(updated) });
}
