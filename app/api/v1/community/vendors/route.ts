import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const HOME_MAINTENANCE_CATEGORIES = [
  'leakage', 'cleaning', 'maid', 'cook', 'painting', 'gardening', 'electrical', 'carpentry', 'other',
] as const;

const schema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(60),
  homeMaintenanceCategory: z.enum(HOME_MAINTENANCE_CATEGORIES).optional(),
  phone: z.string().min(3).max(20),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All vendors/local services for the community, optionally filtered by category or
 *  by the structured home-maintenance tag (for the Home Services filtered view). */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');
  const homeMaintenanceCategory = req.nextUrl.searchParams.get('homeMaintenanceCategory');

  const listings = await prisma.localListing.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(category ? { category } : {}),
      ...((HOME_MAINTENANCE_CATEGORIES as readonly string[]).includes(homeMaintenanceCategory ?? '')
        ? { homeMaintenanceCategory: homeMaintenanceCategory as (typeof HOME_MAINTENANCE_CATEGORIES)[number] }
        : {}),
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

  const { name, category, homeMaintenanceCategory, phone, address, description } = parsed.data;

  const listing = await prisma.localListing.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      category,
      homeMaintenanceCategory,
      phone,
      address,
      description,
      addedById: guard.auth.userId,
      verified: guard.membership.role !== 'member',
    },
  });

  return ok(listing, 201);
}
