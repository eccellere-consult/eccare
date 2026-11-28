import { prisma } from '@/lib/db';
import type { RateCard } from '@/lib/delivery-pricing';

const SINGLETON_ID = 'singleton';

/** The launch switch for delivery partners (PlatformSettings.deliveryEnabled). Off by default. */
export async function isDeliveryEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { deliveryEnabled: true },
  });
  return settings?.deliveryEnabled ?? false;
}

export async function setDeliveryEnabled(enabled: boolean, updatedById: string): Promise<boolean> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { deliveryEnabled: enabled, updatedById },
    create: { id: SINGLETON_ID, deliveryEnabled: enabled, updatedById },
  });
  return settings.deliveryEnabled;
}

/** Automatic payouts to delivery partners through Razorpay Route (Off until Route is active). */
export async function isRoutePayoutsEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
    select: { deliveryRoutePayouts: true },
  });
  return settings?.deliveryRoutePayouts ?? false;
}

export async function setRoutePayoutsEnabled(enabled: boolean, updatedById: string): Promise<boolean> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    update: { deliveryRoutePayouts: enabled, updatedById },
    create: { id: SINGLETON_ID, deliveryRoutePayouts: enabled, updatedById },
  });
  return settings.deliveryRoutePayouts;
}

/** The admin's rate card as plain numbers, creating the row with its defaults on first read. */
export async function getRateCard(): Promise<RateCard> {
  const [card, categories] = await Promise.all([
    prisma.deliveryRateCard.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID } }),
    prisma.deliveryCategoryRate.findMany({ orderBy: { category: 'asc' } }),
  ]);
  return {
    baseCharge: Number(card.baseCharge),
    perKm: Number(card.perKm),
    perKg: Number(card.perKg),
    minimumCharge: Number(card.minimumCharge),
    roadFactor: Number(card.roadFactor),
    sizeMediumSurcharge: Number(card.sizeMediumSurcharge),
    sizeLargeSurcharge: Number(card.sizeLargeSurcharge),
    partnerSharePercent: Number(card.partnerSharePercent),
    categorySurcharges: Object.fromEntries(categories.map((c) => [c.category, Number(c.surcharge)])),
  };
}

/** Saves the rate card. Category surcharges are replaced as a whole list: a category left
 *  out (or set to 0) no longer has an extra charge. */
export async function saveRateCard(card: RateCard, updatedById: string): Promise<RateCard> {
  const { categorySurcharges, ...rates } = card;
  const kept = Object.entries(categorySurcharges).filter(([, v]) => v > 0);
  await prisma.$transaction([
    prisma.deliveryRateCard.upsert({
      where: { id: SINGLETON_ID },
      update: { ...rates, updatedById },
      create: { id: SINGLETON_ID, ...rates, updatedById },
    }),
    prisma.deliveryCategoryRate.deleteMany({ where: { category: { notIn: kept.map(([c]) => c) } } }),
    ...kept.map(([category, surcharge]) =>
      prisma.deliveryCategoryRate.upsert({
        where: { category },
        update: { surcharge },
        create: { category, surcharge },
      }),
    ),
  ]);
  return getRateCard();
}
