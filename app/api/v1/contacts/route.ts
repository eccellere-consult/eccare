import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { getMembership, getPrimaryNeighborhoodId } from '@/lib/community-access';

const CATEGORIES = ['neighbor', 'friend', 'serviceProvider', 'hospital', 'other'] as const;

const createSchema = z.object({
  elderUserId: z.string(),
  name: z.string().min(1).max(160),
  phone: z.string().min(3).max(20),
  category: z.enum(CATEGORIES),
  providerType: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  shareWithCommunity: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  const category = req.nextUrl.searchParams.get('category');

  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder's contacts." } },
      { status: 403 },
    );
  }

  const contacts = await prisma.contact.findMany({
    where: {
      elderUserId,
      ...(category ? { category: category as (typeof CATEGORIES)[number] } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: contacts });
}

/** Adds a personal contact. When the category is `serviceProvider`/`hospital` and
 *  `shareWithCommunity` is set, also creates a linked LocalListing so it surfaces in
 *  the community Vendors directory — pending committee/admin verification unless the
 *  adder already holds that standing, mirroring the existing vendors POST route.
 *  When the category is `neighbor` and `shareWithCommunity` is set, the contact shows
 *  up directly in the community's "Your neighbours" directory instead — no separate
 *  promoted record or verification needed, see the schema comment on
 *  Contact.shareWithNeighbours. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter a name, phone number, and category.' } },
      { status: 400 },
    );
  }

  const { elderUserId, name, phone, category, providerType, notes, shareWithCommunity } = parsed.data;

  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder's contacts." } },
      { status: 403 },
    );
  }

  let sharedListingId: string | null = null;
  let shareWithNeighbours = false;

  if (shareWithCommunity && (category === 'serviceProvider' || category === 'hospital')) {
    const neighborhoodId = await getPrimaryNeighborhoodId(elderUserId);
    if (neighborhoodId) {
      const membership = await getMembership(auth.userId, neighborhoodId);
      const listing = await prisma.localListing.create({
        data: {
          neighborhoodId,
          name,
          category: category === 'serviceProvider' ? (providerType || 'Service provider') : 'Hospital',
          phone,
          addedById: auth.userId,
          verified: membership?.role === 'committee' || membership?.role === 'admin',
        },
      });
      sharedListingId = listing.id;
    }
  } else if (shareWithCommunity && category === 'neighbor') {
    shareWithNeighbours = true;
  }

  const contact = await prisma.contact.create({
    data: {
      elderUserId,
      addedById: auth.userId,
      name,
      phone,
      category,
      providerType: category === 'serviceProvider' ? providerType : undefined,
      notes,
      sharedListingId,
      shareWithNeighbours,
    },
  });

  return NextResponse.json({ success: true, data: contact }, { status: 201 });
}
