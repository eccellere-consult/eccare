import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(60),
  phone: z.string().min(3).max(20),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All vendors/local services for the community, optionally filtered by category. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');

  const listings = await prisma.localListing.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(category ? { category } : {}),
    },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
  });

  return ok(listings);
}

/** Any member can add a vendor; `verified` stays false until the committee vouches
 *  for it, so the UI can distinguish vetted from crowd-sourced entries. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name, category, and phone number.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { name, category, phone, address, description } = parsed.data;

  const listing = await prisma.localListing.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      category,
      phone,
      address,
      description,
      addedById: guard.auth.userId,
      verified: guard.membership.role !== 'member',
    },
  });

  return ok(listing, 201);
}
