import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const createSchema = z.object({
  title: z.string().min(1).max(160),
  listingType: z.enum(['entire_house', 'room']),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().nonnegative().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  houseRules: z.string().max(2000).optional(),
  wheelchairRamp: z.boolean().optional(),
  grabBars: z.boolean().optional(),
  noStepEntry: z.boolean().optional(),
  groundFloor: z.boolean().optional(),
  contactPhone: z.string().min(6).max(20),
  neighborhoodId: z.string().optional(),
});

/** Platform-wide rental marketplace — not gated by community membership, any
 *  authenticated user can browse. ?listingType=, ?city=, ?maxRent=, and the
 *  accessibility flags (?wheelchairRamp=1 etc.) narrow the list; defaults to
 *  active-only unless ?status= is explicitly passed. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const params = req.nextUrl.searchParams;
  const listingType = params.get('listingType');
  const city = params.get('city');
  const maxRent = params.get('maxRent');
  const status = params.get('status');

  const accessibilityFilters: Record<string, boolean> = {};
  for (const key of ['wheelchairRamp', 'grabBars', 'noStepEntry', 'groundFloor'] as const) {
    if (params.get(key) === '1') accessibilityFilters[key] = true;
  }

  const listings = await prisma.rentalListing.findMany({
    where: {
      status: status && ['active', 'in_negotiation', 'rented'].includes(status) ? (status as 'active' | 'in_negotiation' | 'rented') : 'active',
      ...(listingType && ['entire_house', 'room'].includes(listingType) ? { listingType: listingType as 'entire_house' | 'room' } : {}),
      ...(city ? { city: { contains: city } } : {}),
      ...(maxRent ? { monthlyRent: { lte: Number(maxRent) } } : {}),
      ...accessibilityFilters,
    },
    include: { postedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: listings });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0]?.message || 'Please check the details and try again.');

  const listing = await prisma.rentalListing.create({
    data: { ...parsed.data, postedById: auth.userId },
    include: { postedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: listing }, { status: 201 });
}
