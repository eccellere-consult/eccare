import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { DELIVERY_CATEGORY, VEHICLE_TYPES, cleanSlots } from '@/lib/delivery-pricing';
import { isDeliveryEnabled } from '@/lib/delivery-settings';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A signed-in provider whose account is a delivery partner. */
async function requireDeliveryPartner(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'provider') return { error: fail('FORBIDDEN', 'Providers only.', 403) };
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: auth.userId },
    select: { id: true, category: true, verificationStatus: true },
  });
  if (!provider) return { error: fail('NOT_FOUND', 'Complete your provider profile first.', 404) };
  if (provider.category !== DELIVERY_CATEGORY.value) {
    return { error: fail('NOT_DELIVERY', 'This page is for delivery partner accounts.', 403) };
  }
  return { provider };
}

async function loadProfile(providerId: string) {
  return prisma.deliveryPartnerProfile.findUnique({
    where: { providerId },
    include: { slots: { orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] } },
  });
}

/** The partner's delivery details and weekly free-time slots (null before the first save). */
export async function GET(req: NextRequest) {
  const { provider, error } = await requireDeliveryPartner(req);
  if (error) return error;
  const [profile, enabled] = await Promise.all([loadProfile(provider.id), isDeliveryEnabled()]);
  return NextResponse.json({
    success: true,
    data: { profile, verificationStatus: provider.verificationStatus, deliveryEnabled: enabled },
  });
}

const putSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES.map((v) => v.value) as [string, ...string[]]),
  maxWeightKg: z.number().int().min(1).max(200),
  radiusKm: z.number().int().min(1).max(50),
  availableNow: z.boolean(),
  // Plain UPI address, e.g. name@okbank. Optional until the first payout.
  upiId: z
    .string()
    .trim()
    .max(80)
    .regex(/^$|^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/, 'Please enter a UPI ID like name@bank.')
    .nullable()
    .optional(),
  slots: z
    .array(z.object({ dayOfWeek: z.number().int(), startMinute: z.number().int(), endMinute: z.number().int() }))
    .max(42),
});

/** Saves the delivery details and replaces the weekly slots as a whole list. */
export async function PUT(req: NextRequest) {
  const { provider, error } = await requireDeliveryPartner(req);
  if (error) return error;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the details.');

  const cleaned = cleanSlots(parsed.data.slots);
  if (!cleaned.ok) return fail('INVALID_SLOTS', cleaned.message);

  const { slots: _slots, upiId, ...details } = parsed.data;
  const data = { ...details, upiId: upiId ? upiId : null };

  await prisma.$transaction(async (tx) => {
    const profile = await tx.deliveryPartnerProfile.upsert({
      where: { providerId: provider.id },
      update: data,
      create: { providerId: provider.id, ...data },
    });
    await tx.deliverySlot.deleteMany({ where: { partnerId: profile.id } });
    if (cleaned.slots.length > 0) {
      await tx.deliverySlot.createMany({ data: cleaned.slots.map((s) => ({ partnerId: profile.id, ...s })) });
    }
  });

  return NextResponse.json({ success: true, data: { profile: await loadProfile(provider.id) } });
}
