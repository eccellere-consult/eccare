import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { DURATIONS, PLACEMENTS, cleanVideoUrl, priceFor } from '@/lib/campaigns';
import { campaignFields, fail, getPrices, providerFor, serialiseCampaign } from '@/lib/campaigns-server';


const createSchema = z.object({
  ...campaignFields,
  placement: z.enum(PLACEMENTS),
  days: z.union([z.literal(DURATIONS[0]), z.literal(DURATIONS[1]), z.literal(DURATIONS[2])]),
});

/** This provider's offers and ads with their enquiries, plus the current prices. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);
  const provider = await providerFor(auth.userId);
  if (!provider) return fail('NOT_FOUND', 'No provider profile found.', 404);

  const [enabled, prices, campaigns] = await Promise.all([
    isFeatureOn('offers'),
    getPrices(),
    prisma.campaign.findMany({
      where: { providerId: provider.id },
      include: { enquiries: { orderBy: { createdAt: 'desc' }, take: 100 } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return NextResponse.json({
    success: true,
    data: { enabled, prices, provider, campaigns: campaigns.map((c) => serialiseCampaign(c)) },
  });
}

/** Creates a draft offer or ad; the price is fixed now from the admin's price list. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);
  const provider = await providerFor(auth.userId);
  if (!provider) return fail('NOT_FOUND', 'No provider profile found.', 404);
  if (!(await isFeatureOn('offers'))) return fail('NOT_OPEN', 'Offers and ads are not open yet.');

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the details.');
  const d = parsed.data;
  const videoUrl = d.videoUrl ? cleanVideoUrl(d.videoUrl) : null;
  if (d.videoUrl && !videoUrl) return fail('INVALID_INPUT', 'Video link: please paste an https link from YouTube, Instagram or Facebook.');

  const drafts = await prisma.campaign.count({ where: { providerId: provider.id, status: 'draft' } });
  if (drafts >= 10) return fail('TOO_MANY', 'You have 10 unpaid drafts. Please pay for or remove some first.');

  const prices = await getPrices();
  const campaign = await prisma.campaign.create({
    data: {
      providerId: provider.id,
      placement: d.placement,
      title: d.title,
      offerText: d.offerText,
      details: d.details || null,
      videoUrl,
      contactPhone: d.contactPhone || provider.phone || null,
      whatsappPhone: d.whatsappPhone || null,
      days: d.days,
      price: priceFor(prices[d.placement], d.days),
    },
    include: { enquiries: true },
  });
  return NextResponse.json({ success: true, data: serialiseCampaign(campaign) }, { status: 201 });
}
