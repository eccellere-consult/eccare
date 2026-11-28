import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { PLACEMENTS, pickAd, type Placement } from '@/lib/campaigns';
import { PUBLIC_SELECT, imagesOf } from '@/lib/campaigns-server';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/**
 * What elders and families see: every showing offer, and the one sponsored card for a slot.
 *  - no ?ad= : the Offers section (offers + the offers_top ad)
 *  - ?ad=services_top : only the ad for the top of the Services page
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (!(await isFeatureOn('offers'))) return NextResponse.json({ success: true, data: { enabled: false, ad: null, offers: [] } });

  const adSlot = req.nextUrl.searchParams.get('ad') as Placement | null;
  if (adSlot && (!PLACEMENTS.includes(adSlot) || adSlot === 'offer')) return fail('INVALID_INPUT', 'Unknown ad slot.', 400);
  const now = new Date();
  const showing = { status: 'live', startsAt: { lte: now }, endsAt: { gt: now } };

  const tidy = <T extends { imagePaths: unknown }>(c: T) => ({ ...c, imagePaths: imagesOf(c) });
  const ads = await prisma.campaign.findMany({ where: { ...showing, placement: adSlot ?? 'offers_top' }, select: PUBLIC_SELECT });
  const ad = pickAd(ads, now);
  if (adSlot) return NextResponse.json({ success: true, data: { enabled: true, ad: ad ? tidy(ad) : null, offers: [] } });

  const offers = await prisma.campaign.findMany({
    where: { ...showing, placement: 'offer' },
    select: PUBLIC_SELECT,
    orderBy: { startsAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ success: true, data: { enabled: true, ad: ad ? tidy(ad) : null, offers: offers.map(tidy) } });
}
