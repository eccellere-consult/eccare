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

const ELDER_CARE_CATEGORIES = [
  'home_treatment', 'home_nursing', 'companion_service', 'local_errands', 'other',
] as const;

const schema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(60),
  homeMaintenanceCategory: z.enum(HOME_MAINTENANCE_CATEGORIES).optional(),
  shopCategory: z.enum(SHOP_CATEGORIES).optional(),
  elderCareCategory: z.enum(ELDER_CARE_CATEGORIES).optional(),
  phone: z.string().min(3).max(20),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All vendors/local services for the community. Four distinct views share this one
 *  endpoint, disambiguated by which query param is present (not just which value it
 *  has) — this matters because "Home Services, All categories" still needs to mean
 *  "any home-maintenance-tagged listing", not "every listing regardless of tag":
 *  - `?homeMaintenanceCategory=<value-or-empty>` present → Home Services view: any
 *    home-maintenance-tagged listing, optionally narrowed to one specific category.
 *  - `?shopCategory=<value-or-empty>` present → Local Vendors shop-category view:
 *    any shop-tagged listing, optionally narrowed to one specific category.
 *  - `?elderCareCategory=<value-or-empty>` present → community Elder Care view: any
 *    elder-care-tagged listing, optionally narrowed to one specific category.
 *  - None present → the plain Vendors/general list. For an ordinary member this
 *    excludes all three structured segments, so a home-maintenance person, a tagged
 *    shop, or an elder-care provider never also clutters the general list. For a
 *    committee/admin caller it returns EVERY listing regardless of tag instead —
 *    that's deliberate: committee/admin is who assigns these tags (via PATCH), and
 *    without full visibility here a mis-tagged listing would become unreachable to
 *    fix once it disappears from the plain view. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const isManager = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  const category = req.nextUrl.searchParams.get('category');
  const hasHomeMaintenanceParam = req.nextUrl.searchParams.has('homeMaintenanceCategory');
  const hasShopParam = req.nextUrl.searchParams.has('shopCategory');
  const hasElderCareParam = req.nextUrl.searchParams.has('elderCareCategory');
  const homeMaintenanceValue = req.nextUrl.searchParams.get('homeMaintenanceCategory');
  const shopValue = req.nextUrl.searchParams.get('shopCategory');
  const elderCareValue = req.nextUrl.searchParams.get('elderCareCategory');
  const validHomeMaintenanceValue = (HOME_MAINTENANCE_CATEGORIES as readonly string[]).includes(homeMaintenanceValue ?? '')
    ? (homeMaintenanceValue as (typeof HOME_MAINTENANCE_CATEGORIES)[number])
    : undefined;
  const validShopValue = (SHOP_CATEGORIES as readonly string[]).includes(shopValue ?? '')
    ? (shopValue as (typeof SHOP_CATEGORIES)[number])
    : undefined;
  const validElderCareValue = (ELDER_CARE_CATEGORIES as readonly string[]).includes(elderCareValue ?? '')
    ? (elderCareValue as (typeof ELDER_CARE_CATEGORIES)[number])
    : undefined;

  const listings = await prisma.localListing.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(category ? { category } : {}),
      ...(hasHomeMaintenanceParam
        ? { homeMaintenanceCategory: validHomeMaintenanceValue ?? { not: null } }
        : hasShopParam
          ? { shopCategory: validShopValue ?? { not: null } }
          : hasElderCareParam
            ? { elderCareCategory: validElderCareValue ?? { not: null } }
            : isManager
              ? {}
              : { homeMaintenanceCategory: null, shopCategory: null, elderCareCategory: null }),
    },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
  });

  return ok(listings);
}

/** Any member can add a general vendor; `verified` stays false until the committee
 *  vouches for it, so the UI can distinguish vetted from crowd-sourced entries.
 *  Home Services, Local Vendors (shops), and Elder Care listings are different:
 *  creating one with `homeMaintenanceCategory` / `shopCategory` / `elderCareCategory`
 *  set requires manage permission, same as editing one already does — all three are
 *  committee/admin-curated structured views, unlike the free-text general vendor
 *  list. In practice elder-care tagging almost always happens later via PATCH at
 *  verification time, not at creation — this branch exists for symmetry with the
 *  other two tags. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name, category, and phone number.');

  const guard = await requireMembership(req, {
    neighborhoodId: parsed.data.neighborhoodId,
    manage: !!parsed.data.homeMaintenanceCategory || !!parsed.data.shopCategory || !!parsed.data.elderCareCategory,
  });
  if (guard.error) return guard.error;

  const { name, category, homeMaintenanceCategory, shopCategory, elderCareCategory, phone, address, description } = parsed.data;

  const listing = await prisma.localListing.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      category,
      homeMaintenanceCategory,
      shopCategory,
      elderCareCategory,
      phone,
      address,
      description,
      addedById: guard.auth.userId,
      verified: guard.membership.role !== 'member',
    },
  });

  return ok(listing, 201);
}
