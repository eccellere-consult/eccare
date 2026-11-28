import { prisma } from '@/lib/db';
import { houseKey } from '@/lib/house';
import { sendPushToTokens } from '@/lib/push';
import { refundPayment, transferToLinkedAccount } from '@/lib/razorpay';
import { getRateCard, isDeliveryEnabled, isRoutePayoutsEnabled } from '@/lib/delivery-settings';
import {
  DELIVERY_CATEGORY,
  makeHandoverCode,
  orderParcel,
  partnerEarning,
  quoteDelivery,
  rankPartners,
  straightLineKm,
  type DeliveryQuote,
  type DispatchCandidate,
  type ParcelSize,
} from '@/lib/delivery-pricing';

const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));

/** Where the elder lives: the house pin a resident or the committee set (the most exact),
 *  otherwise the location saved on their profile. Null when neither exists. */
export async function elderLocation(elderUserId: string): Promise<{ lat: number; lng: number } | null> {
  const memberships = await prisma.neighborhoodMember.findMany({
    where: { userId: elderUserId, status: 'approved', flatNumber: { not: null } },
    select: { neighborhoodId: true, flatNumber: true },
  });
  for (const m of memberships) {
    const pin = await prisma.houseLocation.findFirst({
      where: { neighborhoodId: m.neighborhoodId, houseKey: houseKey(m.flatNumber) },
      select: { lat: true, lng: true },
    });
    if (pin) return { lat: Number(pin.lat), lng: Number(pin.lng) };
  }
  const user = await prisma.user.findUnique({ where: { id: elderUserId }, select: { lat: true, lng: true } });
  return user?.lat != null && user?.lng != null ? { lat: Number(user.lat), lng: Number(user.lng) } : null;
}

export type OrderDeliveryQuote =
  | { applies: false; reason: 'off' | 'shop_delivers' }
  | { applies: true; quote: DeliveryQuote; weightKg: number; size: ParcelSize; distanceKnown: boolean };

/**
 * The delivery charge for an order before it is placed. No charge when delivery is Off or the
 * shop delivers itself. When the shop's or the elder's location is unknown the distance part is
 * 0 and the minimum charge still applies (distanceKnown tells the screen to say so).
 */
export async function quoteOrderDelivery(input: {
  providerId: string;
  elderUserId: string;
  items: { catalogItemId: string; quantity: number }[];
}): Promise<OrderDeliveryQuote> {
  if (!(await isDeliveryEnabled())) return { applies: false, reason: 'off' };
  const [provider, elder, catalogItems, card] = await Promise.all([
    prisma.serviceProvider.findUnique({
      where: { id: input.providerId },
      select: { usesEcDelivery: true, category: true, lat: true, lng: true },
    }),
    elderLocation(input.elderUserId),
    prisma.catalogItem.findMany({
      where: { id: { in: input.items.map((i) => i.catalogItemId) } },
      select: { id: true, weightKg: true, parcelSize: true },
    }),
    getRateCard(),
  ]);
  if (!provider || !provider.usesEcDelivery) return { applies: false, reason: 'shop_delivers' };

  const byId = new Map(catalogItems.map((c) => [c.id, c]));
  const parcel = orderParcel(
    input.items.map((i) => ({
      weightKg: num(byId.get(i.catalogItemId)?.weightKg),
      parcelSize: byId.get(i.catalogItemId)?.parcelSize ?? null,
      quantity: i.quantity,
    })),
  );
  const from = provider.lat !== null && provider.lng !== null ? { lat: Number(provider.lat), lng: Number(provider.lng) } : null;
  const to = elder;
  const straightKm = from && to ? straightLineKm(from, to) : 0;
  const quote = quoteDelivery(card, { straightKm, weightKg: parcel.weightKg, size: parcel.size, category: provider.category });
  return { applies: true, quote, weightKg: parcel.weightKg, size: parcel.size, distanceKnown: Boolean(from && to) };
}

async function tokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
  return rows.map((r) => r.token);
}

/** Tells the elder and whoever placed the order how their delivery is going. Never throws. */
export async function notifyCustomer(orderId: string, title: string, body: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { elderUserId: true, placedByUserId: true } });
    if (!order) return;
    await sendPushToTokens(await tokensFor([order.elderUserId, order.placedByUserId]), {
      title,
      body,
      data: { type: 'delivery', orderId },
    });
  } catch (err) {
    console.error('Delivery customer notice failed:', err instanceof Error ? err.message : err);
  }
}

/** Every approved delivery partner with what smart dispatch needs to rank them. */
export async function loadDispatchCandidates(): Promise<(DispatchCandidate & { userId: string })[]> {
  const partners = await prisma.deliveryPartnerProfile.findMany({
    where: { provider: { category: DELIVERY_CATEGORY.value } },
    include: {
      slots: true,
      provider: { select: { userId: true, verificationStatus: true, lat: true, lng: true } },
      jobs: { where: { OR: [{ status: { in: ['accepted', 'picked_up'] } }, { rating: { not: null } }] }, select: { status: true, rating: true } },
    },
  });
  return partners.map((p) => {
    const ratings = p.jobs.map((j) => j.rating).filter((r): r is number => typeof r === 'number');
    return {
      id: p.id,
      userId: p.provider.userId,
      verified: p.provider.verificationStatus === 'verified',
      maxWeightKg: p.maxWeightKg,
      radiusKm: p.radiusKm,
      availableNow: p.availableNow,
      slots: p.slots,
      lat: num(p.provider.lat),
      lng: num(p.provider.lng),
      activeJobs: p.jobs.filter((j) => j.status === 'accepted' || j.status === 'picked_up').length,
      ratingAverage: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    };
  });
}

/**
 * Opens the delivery for an order the shop has accepted (or a cash-on-delivery order, which is
 * accepted at once). Does nothing when the order has no EC delivery charge or already has a
 * delivery. Then offers it to the best-matched free partners by push notification.
 */
export async function openDeliveryJob(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      deliveryJob: { select: { id: true } },
      items: { include: { catalogItem: { select: { weightKg: true, parcelSize: true } } } },
      provider: { select: { businessName: true, phone: true, address: true, lat: true, lng: true, user: { select: { phone: true } } } },
      elderUser: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!order || order.deliveryJob || order.deliveryCharge === null) return;

  const card = await getRateCard();
  const charge = Number(order.deliveryCharge);
  const parcel = orderParcel(
    order.items.map((i) => ({ weightKg: num(i.catalogItem?.weightKg), parcelSize: i.catalogItem?.parcelSize ?? null, quantity: i.quantity })),
  );
  const pickupLat = num(order.provider.lat);
  const pickupLng = num(order.provider.lng);
  const drop = await elderLocation(order.elderUser.id);
  const dropLat = drop?.lat ?? null;
  const dropLng = drop?.lng ?? null;
  const roadKm =
    pickupLat !== null && pickupLng !== null && dropLat !== null && dropLng !== null
      ? Math.round(straightLineKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }) * card.roadFactor * 10) / 10
      : 0;
  const isCod = order.paymentMethod === 'cod';
  const total = Number(order.totalAmount);

  try {
    await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        pickupName: order.provider.businessName,
        pickupPhone: order.provider.phone ?? order.provider.user.phone,
        pickupAddress: order.provider.address ?? order.provider.businessName,
        pickupLat,
        pickupLng,
        dropName: order.elderUser.name,
        dropPhone: order.elderUser.phone,
        dropAddress: order.deliveryAddress,
        dropLat,
        dropLng,
        weightKg: parcel.weightKg,
        parcelSize: parcel.size,
        roadKm,
        charge,
        partnerEarning: partnerEarning(charge, card.partnerSharePercent),
        cashToCollect: isCod ? total : null,
        cashToShop: isCod ? Math.round((total - charge) * 100) / 100 : null,
        handoverCode: makeHandoverCode(),
      },
    });
  } catch (err) {
    // Unique orderId: a second call for the same order (double click, retry) simply finds it there.
    if ((err as { code?: string }).code === 'P2002') return;
    throw err;
  }

  await offerToPartners(order.id, { pickupLat, pickupLng, weightKg: parcel.weightKg }, order.provider.businessName, charge);
}

/** Push the new delivery to the 3 best-matched free partners. Never throws. */
async function offerToPartners(
  orderId: string,
  job: { pickupLat: number | null; pickupLng: number | null; weightKg: number },
  shopName: string,
  charge: number,
) {
  try {
    const candidates = await loadDispatchCandidates();
    const ranked = rankPartners(job, candidates, new Date()).slice(0, 3);
    const userIds = ranked.map((r) => candidates.find((c) => c.id === r.id)!.userId);
    await sendPushToTokens(await tokensFor(userIds), {
      title: 'New delivery near you',
      body: `Pick up from ${shopName} · ₹${charge}. Open EC to accept.`,
      data: { type: 'delivery_offer', orderId },
    });
  } catch (err) {
    console.error('Delivery offer push failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * After a delivery is done: a cash order's earning is kept from the cash; a paid-online order
 * is sent to the partner through Razorpay Route when that is switched on and the partner is a
 * linked account, otherwise it waits for the admin to pay by UPI and mark it paid.
 */
export async function settleDeliveredJob(jobId: string): Promise<void> {
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: { order: { select: { paymentMethod: true, razorpayPaymentId: true } }, partner: { select: { razorpayLinkedAccountId: true } } },
  });
  if (!job || job.status !== 'delivered' || job.payoutStatus !== 'unpaid') return;

  if (job.order.paymentMethod === 'cod') {
    await prisma.deliveryJob.update({ where: { id: job.id }, data: { payoutStatus: 'kept_from_cash', paidOutAt: new Date() } });
    return;
  }
  const account = job.partner?.razorpayLinkedAccountId;
  if (!account || !job.order.razorpayPaymentId || !(await isRoutePayoutsEnabled())) return;
  try {
    const transfer = await transferToLinkedAccount(job.order.razorpayPaymentId, account, Number(job.partnerEarning), {
      orderId: job.orderId,
      purpose: 'EC delivery',
    });
    await prisma.deliveryJob.update({
      where: { id: job.id },
      data: { payoutStatus: 'transferred', payoutRef: transfer?.id ?? null, paidOutAt: new Date() },
    });
  } catch (err) {
    // Left as unpaid: the admin sees it in the earnings list and can pay by UPI instead.
    console.error('Route transfer failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Admin: cancel a delivery that cannot happen and refund the customer in full when they paid
 * online. Not for a delivery that is already done.
 */
export async function cancelAndRefund(jobId: string, reason: string): Promise<{ refunded: boolean; refundId?: string }> {
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: { order: { select: { id: true, paymentMethod: true, razorpayPaymentId: true, totalAmount: true, status: true } } },
  });
  if (!job) throw new Error('Delivery not found.');
  if (job.status === 'delivered' || job.status === 'cancelled') throw new Error('This delivery is already finished.');

  let refundId: string | undefined;
  if (job.order.paymentMethod === 'razorpay' && job.order.razorpayPaymentId) {
    const refund = await refundPayment(job.order.razorpayPaymentId, Number(job.order.totalAmount), job.payoutStatus === 'transferred');
    refundId = refund.id;
  }
  await prisma.$transaction([
    prisma.deliveryJob.update({
      where: { id: job.id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason, payoutStatus: refundId ? 'refunded' : job.payoutStatus },
    }),
    prisma.order.update({ where: { id: job.order.id }, data: { status: 'cancelled' } }),
  ]);
  await notifyCustomer(
    job.order.id,
    'Your order was cancelled',
    refundId ? 'Your money is being refunded to the way you paid. It can take 5-7 days.' : reason,
  );
  return { refunded: Boolean(refundId), refundId };
}
