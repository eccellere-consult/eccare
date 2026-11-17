import { prisma } from '@/lib/db';

/** Only the first name is ever shown next to a review: it is a neighbour's opinion, not a public profile. */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'A neighbour';
}

export interface ShopReview {
  stars: number;
  comment: string;
  createdAt: string;
  by: string;
}

/** The newest written reviews for a shop (star-only ratings are counted in the average but have no text to show). */
export async function getRecentShopReviews(providerId: string, take = 6): Promise<ShopReview[]> {
  const rows = await prisma.providerRating.findMany({
    where: { providerId, comment: { not: null } },
    orderBy: { createdAt: 'desc' },
    take,
    select: { stars: true, comment: true, createdAt: true, rater: { select: { name: true } } },
  });
  return rows
    .filter((r) => r.comment && r.comment.trim())
    .map((r) => ({
      stars: r.stars,
      comment: (r.comment as string).trim(),
      createdAt: r.createdAt.toISOString(),
      by: firstNameOf(r.rater.name),
    }));
}

/** True when this person (or a family member placing it for them) has already received an order from this shop. */
export async function hasOrderedFromShop(userId: string, providerId: string): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: {
      providerId,
      status: { in: ['paid', 'confirmed', 'delivered', 'closed'] },
      OR: [{ elderUserId: userId }, { placedByUserId: userId }],
    },
    select: { id: true },
  });
  return Boolean(order);
}
