import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { getProviderRatingSummary } from '@/lib/ratings';
import { getRecentShopReviews, hasOrderedFromShop } from '@/lib/shop-reviews';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found.' } },
    { status: 404 },
  );

/** A vendor's browsable catalog, resolved from LocalListing -> its
 *  CommunityProviderListing connection -> the provider's items. Returns an empty
 *  list (not an error) when the listing has no provider connection — most
 *  LocalListing rows are still plain community-added vendors with no catalog. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.localListing.findUnique({
    where: { id },
    include: { providerListing: true },
  });
  if (!listing) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: listing.neighborhoodId ?? undefined });
  if (guard.error) return guard.error;

  // The shop's own details travel with its catalog, so the page does not depend on the general vendor
  // list (which leaves out shop-tagged listings).
  const vendor = {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    phone: listing.phone,
    address: listing.address,
    verified: listing.verified,
  };

  if (!listing.providerListing) return ok({ listingName: listing.name, vendor, items: [], rating: null, reviews: [], boughtBefore: false });

  const providerId = listing.providerListing.providerId;
  const [items, rating, reviews, boughtBefore] = await Promise.all([
    prisma.catalogItem.findMany({ where: { providerId, inStock: true }, orderBy: { createdAt: 'desc' } }),
    getProviderRatingSummary(providerId),
    getRecentShopReviews(providerId),
    hasOrderedFromShop(guard.auth.userId, providerId),
  ]);

  return ok({
    listingName: listing.name,
    vendor,
    providerId,
    items,
    rating: rating.count > 0 ? rating : null,
    reviews,
    boughtBefore,
  });
}
