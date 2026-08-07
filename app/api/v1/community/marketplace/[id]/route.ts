import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().positive().optional(),
  priceUnit: z.string().max(40).optional(),
  contactPhone: z.string().min(3).max(20).optional(),
  preferredContactTime: z.string().max(120).optional(),
  status: z.enum(['active', 'reserved', 'closed']).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found.' } },
    { status: 404 },
  );

/** Owner edits their own listing (status, price, etc.); committee/admin can also
 *  moderate (e.g. close an inappropriate post) without owning it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!listing) return notFound();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: listing.neighborhoodId });
  if (guard.error) return guard.error;

  const isOwner = guard.auth.userId === listing.postedById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isOwner && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own listing.' } },
      { status: 403 },
    );
  }

  const updated = await prisma.marketplaceListing.update({ where: { id }, data: parsed.data });

  return ok(updated);
}

/** Owner deletes their own listing; committee/admin can remove any (moderation). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!listing) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: listing.neighborhoodId });
  if (guard.error) return guard.error;

  const isOwner = guard.auth.userId === listing.postedById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isOwner && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You can only remove your own listing.' } },
      { status: 403 },
    );
  }

  await prisma.marketplaceListing.delete({ where: { id } });

  return ok(null);
}
