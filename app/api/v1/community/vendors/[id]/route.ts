import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  verified: z.boolean().optional(),
  name: z.string().min(1).max(160).optional(),
  category: z.string().min(1).max(60).optional(),
  homeMaintenanceCategory: z
    .enum(['leakage', 'cleaning', 'maid', 'cook', 'painting', 'gardening', 'electrical', 'carpentry', 'other'])
    .nullable()
    .optional(),
  phone: z.string().min(3).max(20).optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found.' } },
    { status: 404 },
  );

/** A handful of legacy listings predate neighborhoodId being required and have none —
 *  those can only be managed by a platform admin, never resolved through a caller's
 *  own community membership (which could be a different, unrelated neighborhood). */
async function requireManage(req: NextRequest, neighborhoodId: string | null): Promise<{ error?: NextResponse }> {
  if (!neighborhoodId) {
    const auth = await getAuthUser(req);
    if (!auth || auth.role !== 'admin') {
      return {
        error: NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Only an admin can manage this listing.' } },
          { status: 403 },
        ),
      };
    }
    return {};
  }
  return requireMembership(req, { neighborhoodId, manage: true });
}

/** Verify (vouch for) or edit a vendor listing — committee/admin only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.localListing.findUnique({ where: { id } });
  if (!listing) return notFound();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireManage(req, listing.neighborhoodId);
  if (guard.error) return guard.error;

  const updated = await prisma.localListing.update({ where: { id }, data: parsed.data });

  return ok(updated);
}

/** Remove a vendor listing — committee/admin only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.localListing.findUnique({ where: { id } });
  if (!listing) return notFound();

  const guard = await requireManage(req, listing.neighborhoodId);
  if (guard.error) return guard.error;

  await prisma.localListing.delete({ where: { id } });

  return ok(null);
}
