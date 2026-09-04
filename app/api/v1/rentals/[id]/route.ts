import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const updateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  monthlyRent: z.number().positive().optional(),
  securityDeposit: z.number().nonnegative().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  houseRules: z.string().max(2000).nullable().optional(),
  wheelchairRamp: z.boolean().optional(),
  grabBars: z.boolean().optional(),
  noStepEntry: z.boolean().optional(),
  groundFloor: z.boolean().optional(),
  contactPhone: z.string().min(6).max(20).optional(),
  status: z.enum(['active', 'in_negotiation', 'rented']).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({
    where: { id },
    include: { postedBy: { select: { id: true, name: true } } },
  });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);

  return NextResponse.json({ success: true, data: listing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({ where: { id } });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (listing.postedById !== auth.userId && auth.role !== 'admin') {
    return fail('FORBIDDEN', 'Only the lister can edit this listing.', 403);
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.');

  const updated = await prisma.rentalListing.update({
    where: { id },
    data: parsed.data,
    include: { postedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({ where: { id } });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (listing.postedById !== auth.userId && auth.role !== 'admin') {
    return fail('FORBIDDEN', 'Only the lister can remove this listing.', 403);
  }

  await prisma.rentalListing.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
