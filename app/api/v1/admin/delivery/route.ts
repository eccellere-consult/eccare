import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { DELIVERY_CATEGORY } from '@/lib/delivery-pricing';
import { getRateCard, isDeliveryEnabled, saveRateCard, setDeliveryEnabled } from '@/lib/delivery-settings';

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
          slots: { select: { dayOfWeek: true, startMinute: true, endMinute: true }, orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] },
        },
      },
    },
  });
  return rows;
}

/** Everything on Admin > Delivery: the launch switch, the rate card and the partners. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  const [enabled, rateCard, partners] = await Promise.all([isDeliveryEnabled(), getRateCard(), loadPartners()]);
  return NextResponse.json({ success: true, data: { enabled, rateCard, partners } });
}

const money = z.number().min(0).max(100000);
const patchSchema = z.object({
  enabled: z.boolean().optional(),
  rateCard: z
    .object({
      baseCharge: money,
      perKm: money,
      perKg: money,
      minimumCharge: money,
      roadFactor: z.number().min(1).max(3),
      sizeMediumSurcharge: money,
      sizeLargeSurcharge: money,
      categorySurcharges: z.record(z.string().min(1).max(80), money),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success || (parsed.data.enabled === undefined && !parsed.data.rateCard)) {
    return fail('INVALID_INPUT', parsed.success ? 'Nothing to save.' : parsed.error.issues[0]?.message || 'Please check the values.');
  }

  const [enabled, rateCard] = await Promise.all([
    parsed.data.enabled !== undefined ? setDeliveryEnabled(parsed.data.enabled, auth!.userId) : isDeliveryEnabled(),
    parsed.data.rateCard ? saveRateCard(parsed.data.rateCard, auth!.userId) : getRateCard(),
  ]);
  return NextResponse.json({ success: true, data: { enabled, rateCard, partners: await loadPartners() } });
}
