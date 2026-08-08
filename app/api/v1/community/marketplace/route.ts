import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  listingType: z.enum(['sell', 'rent', 'lend', 'wanted']),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  price: z.number().positive().optional(),
  priceUnit: z.string().max(40).optional(),
  contactPhone: z.string().min(3).max(20),
  houseNumber: z.string().max(40).optional(),
  preferredContactTime: z.string().max(120).optional(),
  neighborhoodId: z.string().optional(),
});

/** All marketplace listings for the community, optionally filtered by type. Closed/
 *  reserved listings still show — a poster may want to point a buyer back at "reserved"
 *  rather than have it vanish, and there's no volume yet that justifies hiding them. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const listingType = req.nextUrl.searchParams.get('listingType');

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(listingType ? { listingType: listingType as 'sell' | 'rent' | 'lend' | 'wanted' } : {}),
    },
    include: { postedBy: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return ok(listings);
}

/** Any member can post a listing — no committee gate, this is peer-to-peer. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return invalidInput('Please enter a title, a contact number, and pick a listing type.');
  }

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { listingType, title, description, price, priceUnit, contactPhone, houseNumber, preferredContactTime } =
    parsed.data;

  const listing = await prisma.marketplaceListing.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      postedById: guard.auth.userId,
      listingType,
      title,
      description,
      price,
      priceUnit,
      contactPhone,
      houseNumber,
      preferredContactTime,
    },
  });

  return ok(listing, 201);
}
