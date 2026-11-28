import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePartner } from '@/lib/delivery-partner-access';
import { loadDispatchCandidates } from '@/lib/delivery-jobs';
import { MAX_ACTIVE_JOBS, isWithinSlots, rankPartners } from '@/lib/delivery-pricing';

const n = (d: unknown) => (d === null || d === undefined ? null : Number(d));

/**
 * A delivery partner's work: deliveries they can take now (smart dispatch: only ones that suit
 * them, nearest first), the ones they are carrying, and their finished ones with earnings.
 * Phone numbers appear only once they have accepted; the handover code never does (the
 * customer reads it out at the door).
 */
export async function GET(req: NextRequest) {
  const { error, partnerId } = await requirePartner(req);
  if (error) return error;

  const [candidates, open, mine, done] = await Promise.all([
    loadDispatchCandidates(),
    prisma.deliveryJob.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' }, take: 50 }),
    prisma.deliveryJob.findMany({
      where: { partnerId, status: { in: ['accepted', 'picked_up'] } },
      orderBy: { acceptedAt: 'asc' },
      include: { order: { select: { paymentMethod: true, items: { select: { name: true, quantity: true } } } } },
    }),
    prisma.deliveryJob.findMany({
      where: { partnerId, status: 'delivered' },
      orderBy: { deliveredAt: 'desc' },
      take: 30,
      select: {
        id: true,
        pickupName: true,
        dropAddress: true,
        deliveredAt: true,
        partnerEarning: true,
        payoutStatus: true,
        payoutRef: true,
        rating: true,
        cashToShop: true,
        cashHandedToShopAt: true,
      },
    }),
  ]);

  const me = candidates.find((c) => c.id === partnerId);
  const now = new Date();
  const available = me
    ? open
        .map((j) => {
          const fit = rankPartners({ pickupLat: n(j.pickupLat), pickupLng: n(j.pickupLng), weightKg: n(j.weightKg) ?? 0 }, [me], now)[0];
          return fit
            ? {
                id: j.id,
                pickupName: j.pickupName,
                pickupAddress: j.pickupAddress,
                dropAddress: j.dropAddress,
                roadKm: n(j.roadKm),
                distanceToShopKm: fit.distanceKm,
                weightKg: n(j.weightKg),
                parcelSize: j.parcelSize,
                partnerEarning: n(j.partnerEarning),
                cashToCollect: n(j.cashToCollect),
                createdAt: j.createdAt,
                score: fit.score,
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.score - b.score)
    : [];

  const all = await prisma.deliveryJob.findMany({
    where: { partnerId, status: 'delivered' },
    select: { partnerEarning: true, payoutStatus: true, rating: true },
  });
  const sum = (rows: typeof all) => Math.round(rows.reduce((a, r) => a + Number(r.partnerEarning), 0) * 100) / 100;
  const ratings = all.map((r) => r.rating).filter((r): r is number => typeof r === 'number');

  return NextResponse.json({
    success: true,
    data: {
      canTakeMore: Boolean(me && me.activeJobs < MAX_ACTIVE_JOBS),
      freeNow: Boolean(me && (me.availableNow || isWithinSlots(me.slots, now))),
      verified: me?.verified ?? false,
      available,
      mine: mine.map(({ handoverCode: _code, ...j }) => ({
        ...j,
        roadKm: n(j.roadKm),
        weightKg: n(j.weightKg),
        charge: n(j.charge),
        partnerEarning: n(j.partnerEarning),
        cashToCollect: n(j.cashToCollect),
        cashToShop: n(j.cashToShop),
        pickupLat: n(j.pickupLat),
        pickupLng: n(j.pickupLng),
        dropLat: n(j.dropLat),
        dropLng: n(j.dropLng),
      })),
      done: done.map((j) => ({ ...j, partnerEarning: n(j.partnerEarning), cashToShop: n(j.cashToShop) })),
      earnings: {
        unpaid: sum(all.filter((r) => r.payoutStatus === 'unpaid')),
        paid: sum(all.filter((r) => r.payoutStatus === 'paid' || r.payoutStatus === 'transferred')),
        keptFromCash: sum(all.filter((r) => r.payoutStatus === 'kept_from_cash')),
        deliveries: all.length,
        ratingAverage: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      },
    },
  });
}
