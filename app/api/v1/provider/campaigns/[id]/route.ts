import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { deleteFromStorage } from '@/lib/storage';
import { cleanVideoUrl } from '@/lib/campaigns';
import { campaignFields, fail, imagesOf, providerFor, serialiseCampaign } from '@/lib/campaigns-server';

const patchSchema = z.object(campaignFields).partial();

async function ownDraft(userId: string, id: string) {
  const provider = await providerFor(userId);
  if (!provider) return null;
  return prisma.campaign.findFirst({ where: { id, providerId: provider.id } });
}

/** Edits an offer or ad before it is paid for (after payment EC reviews exactly what was paid for). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const campaign = await ownDraft(auth.userId, id);
  if (!campaign) return fail('NOT_FOUND', 'Not found.', 404);
  if (campaign.status !== 'draft') return fail('BAD_STATE', 'Paid offers cannot be changed. Please make a new one.');

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the details.');
  const { videoUrl: rawVideo, ...rest } = parsed.data;
  const videoUrl = rawVideo === undefined ? undefined : rawVideo ? cleanVideoUrl(rawVideo) : null;
  if (rawVideo && !videoUrl) return fail('INVALID_INPUT', 'Video link: please paste an https link from YouTube, Instagram or Facebook.');

  const updated = await prisma.campaign.update({
    where: { id },
    data: { ...rest, ...(videoUrl !== undefined ? { videoUrl } : {}) },
    include: { enquiries: { orderBy: { createdAt: 'desc' }, take: 100 } },
  });
  return NextResponse.json({ success: true, data: serialiseCampaign(updated) });
}

/** Removes an unpaid draft and its photos. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const campaign = await ownDraft(auth.userId, id);
  if (!campaign) return fail('NOT_FOUND', 'Not found.', 404);
  if (campaign.status !== 'draft') return fail('BAD_STATE', 'Only an unpaid draft can be removed.');

  await prisma.campaign.delete({ where: { id } });
  await Promise.all(imagesOf(campaign).map((p) => deleteFromStorage(p).catch(() => {})));
  return NextResponse.json({ success: true, data: { id } });
}
