import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const HOME_MAINTENANCE_CATEGORIES = [
  'leakage', 'cleaning', 'maid', 'cook', 'painting', 'gardening', 'electrical', 'carpentry', 'other',
] as const;

const SHOP_CATEGORIES = [
  'medical_store', 'supermarket', 'electrical_supplies', 'hardware_store', 'stationery', 'bakery', 'other',
] as const;

const schema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(60),
  homeMaintenanceCategory: z.enum(HOME_MAINTENANCE_CATEGORIES).optional(),
  shopCategory: z.enum(SHOP_CATEGORIES).optional(),
  phone: z.string().min(3).max(20),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All vendors/local services for the community. Three distinct views share this one
 *  endpoint, disambiguated by which query param is present (not just which value it
 *  has) — this matters because "Home Services, All categories" still needs to mean
 *  "any home-maintenance-tagged listing", not "every listing regardless of tag":
 *  - `?homeMaintenanceCategory=<value-or-empty>` present → Home Services view: any
 *    home-maintenance-tagged listing, optionally narrowed to one specific category.
 *  - `?shopCategory=<value-or-empty>` present → Local Vendors shop-category view:
 *    any shop-tagged listing, optionally narrowed to one specific category.
 *  - Neither present → the plain Vendors/general list, which excludes BOTH structured
 *    segments so a home-maintenance person or a tagged shop never also clutters the
 *    general list — this is the fix for the classification-overlap the general
 *    Vendors view used to have. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');
  const hasHomeMaintenanceParam = req.nextUrl.searchParams.has('homeMaintenanceCategory');
  const hasShopParam = req.nextUrl.searchParams.has('shopCategory');
  const homeMaintenanceValue = req.nextUrl.searchParams.get('homeMaintenanceCategory');
  const shopValue = req.nextUrl.searchParams.get('shopCategory');
  const validHomeMaintenanceValue = (HOME_MAINTENANCE_CATEGORIES as readonly string[]).includes(homeMaintenanceValue ?? '')
    ? (homeMaintenanceValue as (typeof HOME_MAINTENANCE_CATEGORIES)[number])
    : undefined;
  const validShopValue = (SHOP_CATEGORIES as readonly string[]).includes(shopValue ?? '')
    ? (shopValue as (typeof SHOP_CATEGORIES)[number])
    : undefined;

  const listings = await prisma.localListing.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(category ? { category } : {}),
      ...(hasHomeMaintenanceParam
        ? { homeMaintenanceCategory: validHomeMaintenanceValue ?? { not: null } }
        : hasShopParam
          ? { shopCategory: validShopValue ?? { not: null } }
          : { homeMaintenanceCategory: null, shopCategory: null }),
    },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
  });

  return ok(listings);
}

/** Any member can add a general vendor; `verified` stays false until the committee
 *  vouches for it, so the UI can distinguish vetted from crowd-sourced entries.
 *  Home Services and Local Vendors (shops) listings are different: creating one with
 *  `homeMaintenanceCategory` or `shopCategory` set requires manage permission, same
 *  as editing one already does — both are committee/admin-curated structured views,
 *  unlike the free-text general vendor list. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name, category, and phone number.');

  const guard = await requireMembership(req, {
    neighborhoodId: parsed.data.neighborhoodId,
    manage: !!parsed.data.homeMaintenanceCategory || !!parsed.data.shopCategory,
  });
  if (guard.error) return guard.error;

  const { name, category, homeMaintenanceCategory, shopCategory, phone, address, description } = parsed.data;

  const listing = await prisma.localListing.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      category,
      homeMaintenanceCategory,
      shopCategory,
      phone,
      address,
      description,
      addedById: guard.auth.userId,
      verified: guard.membership.role !== 'member',
    },
  });

  return ok(listing, 201);
}
