import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

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

  if (!listing.providerListing) return ok({ listingName: listing.name, items: [] });

  const items = await prisma.catalogItem.findMany({
    where: { providerId: listing.providerListing.providerId, inStock: true },
    orderBy: { createdAt: 'desc' },
  });

  return ok({ listingName: listing.name, providerId: listing.providerListing.providerId, items });
}
