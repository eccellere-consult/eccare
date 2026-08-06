import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Charge not found.' } }, { status: 404 });

const patchSchema = z.object({
  amount: z.number().positive().optional(),
  status: z.enum(['due', 'waived']).optional(),
});

/** Committee-side edit: override one flat's bill amount (e.g. a larger unit pays
 *  more than the community default), or waive a charge outright (e.g. a resident
 *  facing hardship). Only valid while the charge is still 'due' — a paid charge is
 *  a real transaction record at that point, not something to quietly rewrite. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const charge = await prisma.feeCharge.findUnique({ where: { id } });
  if (!charge) return notFound();

  const communityFee = await prisma.communityFee.findUnique({ where: { id: charge.communityFeeId } });
  if (!communityFee) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: communityFee.neighborhoodId });
  if (guard.error) return guard.error;

  if (charge.status === 'paid') {
    return NextResponse.json(
      { success: false, error: { code: 'ALREADY_PAID', message: 'This charge has already been paid and cannot be edited.' } },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();
  if (Object.keys(parsed.data).length === 0) return invalidInput('Nothing to update.');

  const updated = await prisma.feeCharge.update({ where: { id }, data: parsed.data });
  return ok(updated);
}
