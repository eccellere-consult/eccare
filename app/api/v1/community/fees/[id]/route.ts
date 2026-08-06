import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Fee not found.' } }, { status: 404 });

const patchSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  defaultAmount: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

/** Edits a fee's label/default amount/active flag — never touches charges already
 *  generated (see FeeCharge.amount's own comment: charges snapshot the amount at
 *  generation time on purpose). Turning isActive off stops future "generate this
 *  cycle" runs from picking this fee up, without deleting its billing history. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fee = await prisma.communityFee.findUnique({ where: { id } });
  if (!fee) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: fee.neighborhoodId });
  if (guard.error) return guard.error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();
  if (Object.keys(parsed.data).length === 0) return invalidInput('Nothing to update.');

  const updated = await prisma.communityFee.update({ where: { id }, data: parsed.data });
  return ok(updated);
}
