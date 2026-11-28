import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { PLACEMENTS, PLACEMENT_INFO, effectiveStatus, type Placement } from '@/lib/campaigns';

export const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export type Prices = Record<Placement, number>;

/** The admin's 30-day price for each placement (defaults from lib/campaigns.ts until set). */
export async function getPrices(): Promise<Prices> {
  const rows = await prisma.campaignPrice.findMany();
  return Object.fromEntries(
    PLACEMENTS.map((p) => {
      const row = rows.find((r) => r.placement === p);
      return [p, row ? Number(row.pricePer30Days) : PLACEMENT_INFO[p].defaultPricePer30Days];
    }),
  ) as Prices;
}

export async function savePrices(prices: Partial<Prices>, updatedById: string): Promise<Prices> {
  await prisma.$transaction(
    Object.entries(prices)
      .filter(([p, v]) => (PLACEMENTS as readonly string[]).includes(p) && typeof v === 'number' && v > 0)
      .map(([placement, v]) =>
        prisma.campaignPrice.upsert({
          where: { placement },
          update: { pricePer30Days: v as number, updatedById },
          create: { placement, pricePer30Days: v as number, updatedById },
        }),
      ),
  );
  return getPrices();
}

/** The signed-in provider's row (any category can run offers). */
export async function providerFor(userId: string) {
  return prisma.serviceProvider.findUnique({
    where: { userId },
    select: { id: true, businessName: true, phone: true, verificationStatus: true },
  });
}

type CampaignRow = {
  price: unknown;
  imagePaths: unknown;
  status: string;
  endsAt: Date | null;
  [k: string]: unknown;
};

export function imagesOf(c: { imagePaths: unknown }): string[] {
  return Array.isArray(c.imagePaths) ? (c.imagePaths.filter((x) => typeof x === 'string') as string[]) : [];
}

/** Plain numbers and the status as people should see it (a finished live one shows "Ended"). */
export function serialiseCampaign<T extends CampaignRow>(c: T, now = new Date()) {
  return { ...c, price: Number(c.price), imagePaths: imagesOf(c), status: effectiveStatus(c, now) };
}

/** Refunds a campaign payment in full (Razorpay). Amount in rupees. */
export async function refundCampaignPayment(paymentId: string, amountRupees: number) {
  const client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  return client.payments.refund(paymentId, { amount: Math.round(amountRupees * 100) });
}

/** What elders and families see of a showing campaign: no payment details. */
export const PUBLIC_SELECT = {
  id: true,
  placement: true,
  title: true,
  offerText: true,
  details: true,
  imagePaths: true,
  videoUrl: true,
  contactPhone: true,
  whatsappPhone: true,
  startsAt: true,
  endsAt: true,
  provider: { select: { businessName: true, serviceArea: true } },
} as const;

/** Fields a provider fills in for an offer or ad (shared by create and edit). */
export const campaignFields = {
  title: z.string().trim().min(3).max(80),
  offerText: z.string().trim().min(3).max(120),
  details: z.string().trim().max(1500).nullable().optional(),
  videoUrl: z.string().trim().max(300).nullable().optional(),
  contactPhone: z.string().trim().max(20).nullable().optional(),
  whatsappPhone: z.string().trim().max(20).nullable().optional(),
};
