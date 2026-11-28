import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { fail, getPrices, savePrices, serialiseCampaign } from '@/lib/campaigns-server';

async function admin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { auth: null, error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'admin') return { auth: null, error: fail('FORBIDDEN', 'Admins only.', 403) };
  return { auth, error: null };
}

/** Every paid offer and ad (unpaid drafts are the provider's own business), plus prices and the switch. */
export async function GET(req: NextRequest) {
  const { error } = await admin(req);
  if (error) return error;
  const [enabled, prices, campaigns] = await Promise.all([
    isFeatureOn('offers'),
    getPrices(),
    prisma.campaign.findMany({
      where: { status: { not: 'draft' } },
      include: {
        provider: { select: { businessName: true, phone: true, verificationStatus: true } },
        _count: { select: { enquiries: true } },
      },
      orderBy: [{ paidAt: 'desc' }],
      take: 500,
    }),
  ]);
  return NextResponse.json({ success: true, data: { enabled, prices, campaigns: campaigns.map((c) => serialiseCampaign(c)) } });
}

const priceSchema = z.object({
  offer: z.number().positive().max(100_000).optional(),
  offers_top: z.number().positive().max(100_000).optional(),
  services_top: z.number().positive().max(100_000).optional(),
});

/** Sets the 30-day price of each placement. Offers already created keep the price they were made with. */
export async function PATCH(req: NextRequest) {
  const { auth, error } = await admin(req);
  if (error || !auth) return error ?? fail('UNAUTHORIZED', 'Please log in.', 401);
  const parsed = priceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Please give prices in rupees.');
  return NextResponse.json({ success: true, data: await savePrices(parsed.data, auth.userId) });
}
