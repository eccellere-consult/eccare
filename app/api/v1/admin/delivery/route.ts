import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { DELIVERY_CATEGORY } from '@/lib/delivery-pricing';
import {
  getRateCard,
  isDeliveryEnabled,
  isRoutePayoutsEnabled,
  saveRateCard,
  setDeliveryEnabled,
  setRoutePayoutsEnabled,
} from '@/lib/delivery-settings';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'admin') return { error: fail('FORBIDDEN', 'Admins only.', 403) };
  return { auth };
}

async function loadPartners() {
  const rows = await prisma.serviceProvider.findMany({
    where: { category: DELIVERY_CATEGORY.value },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      businessName: true,
      serviceArea: true,
      verificationStatus: true,
      certificationFilePath: true,
      createdAt: true,
      user: { select: { name: true, phone: true } },
      deliveryProfile: {
        select: {
          vehicleType: true,
          maxWeightKg: true,
          radiusKm: true,
          availableNow: true,
          upiId: true,
          razorpayLinkedAccountId: true,
          jobs: { where: { status: 'delivered' }, select: { partnerEarning: true, payoutStatus: true, rating: true } },
          slots: { select: { dayOfWeek: true, startMinute: true, endMinute: true }, orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] },
        },
      },
    },
  });
  return rows.map(({ deliveryProfile, ...p }) => {
    if (!deliveryProfile) return { ...p, deliveryProfile: null, summary: null };
    const { jobs, ...profile } = deliveryProfile;
    const ratings = jobs.map((j) => j.rating).filter((r): r is number => typeof r === 'number');
    const unpaid = jobs.filter((j) => j.payoutStatus === 'unpaid').reduce((a, j) => a + Number(j.partnerEarning), 0);
    return {
      ...p,
      deliveryProfile: profile,
      summary: {
        deliveries: jobs.length,
        unpaid: Math.round(unpaid * 100) / 100,
        ratingAverage: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        ratingCount: ratings.length,
      },
    };
  });
}

/** The latest deliveries, newest first, with what the admin needs to pay, chase or refund. */
async function loadJobs() {
  const jobs = await prisma.deliveryJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      status: true,
      pickupName: true,
      dropName: true,
      dropAddress: true,
      charge: true,
      partnerEarning: true,
      cashToCollect: true,
      cashToShop: true,
      cashHandedToShopAt: true,
      payoutStatus: true,
      payoutRef: true,
      rating: true,
      createdAt: true,
      deliveredAt: true,
      order: { select: { paymentMethod: true, totalAmount: true } },
      partner: { select: { upiId: true, razorpayLinkedAccountId: true, provider: { select: { user: { select: { name: true, phone: true } } } } } },
    },
  });
  return jobs.map((j) => ({
    ...j,
    charge: Number(j.charge),
    partnerEarning: Number(j.partnerEarning),
    cashToCollect: j.cashToCollect === null ? null : Number(j.cashToCollect),
    cashToShop: j.cashToShop === null ? null : Number(j.cashToShop),
    order: { ...j.order, totalAmount: Number(j.order.totalAmount) },
  }));
}

async function loadAll() {
  const [enabled, routePayouts, rateCard, partners, jobs] = await Promise.all([
    isDeliveryEnabled(),
    isRoutePayoutsEnabled(),
    getRateCard(),
    loadPartners(),
    loadJobs(),
  ]);
  return { enabled, routePayouts, rateCard, partners, jobs };
}

/** Everything on Admin > Delivery: the launch switch, the rate card and the partners. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  return NextResponse.json({ success: true, data: await loadAll() });
}

const money = z.number().min(0).max(100000);
const patchSchema = z.object({
  enabled: z.boolean().optional(),
  routePayouts: z.boolean().optional(),
  rateCard: z
    .object({
      baseCharge: money,
      perKm: money,
      perKg: money,
      minimumCharge: money,
      roadFactor: z.number().min(1).max(3),
      sizeMediumSurcharge: money,
      sizeLargeSurcharge: money,
      partnerSharePercent: z.number().min(0).max(100),
      categorySurcharges: z.record(z.string().min(1).max(80), money),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success || (parsed.data.enabled === undefined && parsed.data.routePayouts === undefined && !parsed.data.rateCard)) {
    return fail('INVALID_INPUT', parsed.success ? 'Nothing to save.' : parsed.error.issues[0]?.message || 'Please check the values.');
  }

  if (parsed.data.enabled !== undefined) await setDeliveryEnabled(parsed.data.enabled, auth!.userId);
  if (parsed.data.routePayouts !== undefined) await setRoutePayoutsEnabled(parsed.data.routePayouts, auth!.userId);
  if (parsed.data.rateCard) await saveRateCard(parsed.data.rateCard, auth!.userId);
  return NextResponse.json({ success: true, data: await loadAll() });
}
