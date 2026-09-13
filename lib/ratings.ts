import { prisma } from '@/lib/db';

export type RatingContext =
  | { orderId: string }
  | { doctorBookingId: string }
  | { consultationId: string }
  | { propertyInvoiceId: string }
  | { autoBookingId: string };

/**
 * Shared write path for every "close + rate" route across every provider
 * category (Orders, Doctor bookings, Advisory, Property Management,
 * Auto-booking) — see prisma/schema.prisma's ProviderRating doc comment for
 * why this is one shared model rather than five near-identical ones.
 *
 * Exactly one of the transaction-id fields in `context` must be set; the
 * caller passes the single relevant one (e.g. `{ orderId }`). `providerId`
 * can be null when the source record (a legacy admin-added LocalDoctor/
 * AutoDriver row, or an AdvisoryExpert never linked to a real ServiceProvider
 * account) has no real provider to attribute the rating to — in that case
 * this is a no-op, since there's nothing to rate.
 */
export async function createRating(input: {
  providerId: string | null;
  raterUserId: string;
  stars: number;
  comment?: string;
  context: RatingContext;
}) {
  if (!input.providerId) return null;
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) {
    throw new Error('Rating must be an integer between 1 and 5.');
  }

  return prisma.providerRating.create({
    data: {
      providerId: input.providerId,
      raterUserId: input.raterUserId,
      stars: input.stars,
      comment: input.comment?.trim() || undefined,
      ...input.context,
    },
  });
}

export interface ProviderRatingSummary {
  average: number | null;
  count: number;
}

/** Star average + count for a provider, shown wherever they're listed
 *  (vendor/doctor/driver cards, advisory expert, property-management picker). */
export async function getProviderRatingSummary(providerId: string): Promise<ProviderRatingSummary> {
  const result = await prisma.providerRating.aggregate({
    where: { providerId },
    _avg: { stars: true },
    _count: true,
  });
  return { average: result._avg.stars, count: result._count };
}

/** Batch variant for listing pages showing many providers at once (avoids an
 *  N+1 aggregate query per card). Providers with no ratings are simply
 *  absent from the returned map — callers should treat a missing key the
 *  same as { average: null, count: 0 }. */
export async function getProviderRatingSummaries(
  providerIds: string[],
): Promise<Map<string, ProviderRatingSummary>> {
  if (providerIds.length === 0) return new Map();
  const rows = await prisma.providerRating.groupBy({
    by: ['providerId'],
    where: { providerId: { in: providerIds } },
    _avg: { stars: true },
    _count: true,
  });
  return new Map(rows.map((r) => [r.providerId, { average: r._avg.stars, count: r._count }]));
}
