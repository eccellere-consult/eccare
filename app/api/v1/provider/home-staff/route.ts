import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { STAFF_ROLES } from '@/lib/care-staff';
import { careStaffProviderFor, fail, LISTING_INCLUDE, serialiseListing } from '@/lib/care-staff-server';

const ROLE_VALUES = STAFF_ROLES.map((r) => r.value) as [string, ...string[]];
const createSchema = z.object({
  personName: z.string().trim().min(2).max(80),
  role: z.enum(ROLE_VALUES),
});

/** The home-care staff this provider has listed, with their documents and rates. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const provider = await careStaffProviderFor(auth.userId);
  if (!provider) return fail('FORBIDDEN', 'This page is for home-care staff providers.', 403);

  const [enabled, listings] = await Promise.all([
    isFeatureOn('care_staff'),
    prisma.careStaffListing.findMany({
      where: { providerId: provider.id },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return NextResponse.json({
    success: true,
    data: { enabled, provider, listings: listings.map(serialiseListing) },
  });
}

/** Adds a person (an individual adds themselves; an agency adds each worker). */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const provider = await careStaffProviderFor(auth.userId);
  if (!provider) return fail('FORBIDDEN', 'This page is for home-care staff providers.', 403);
  if (!(await isFeatureOn('care_staff'))) return fail('NOT_OPEN', 'Home-care staff listings are not open yet.', 400);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Please give the name and the kind of work.');

  const count = await prisma.careStaffListing.count({ where: { providerId: provider.id } });
  if (count >= 200) return fail('TOO_MANY', 'You can list up to 200 people. Please write to EC for more.');

  const listing = await prisma.careStaffListing.create({
    data: { providerId: provider.id, personName: parsed.data.personName.toUpperCase(), role: parsed.data.role },
    include: LISTING_INCLUDE,
  });
  return NextResponse.json({ success: true, data: serialiseListing(listing) }, { status: 201 });
}
