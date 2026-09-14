import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Not found in this directory.' } },
    { status: 404 },
  );

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  phone: z.string().max(20).optional().nullable(),
  flatNumber: z.string().max(40).optional().nullable(),
  // Set by the WhatsApp-invite queue step once the admin has stepped through
  // this row — purely informational (see schema.prisma), never gates
  // anything, so this is the only field that isn't committee/admin-only in
  // spirit even though the route itself still is.
  invited: z.boolean().optional(),
});

/** committee/admin-only editing for an UnregisteredResident directory entry
 *  — there's no owner to defer to (unlike a shared Contact), so unlike that
 *  entry type, edit here is a real rename/re-flat/re-phone, not just a
 *  remove-from-directory toggle. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.unregisteredResident.findUnique({ where: { id } });
  if (!entry) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: entry.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return invalidInput(parsed.error?.issues?.[0]?.message || 'Please check the details and try again.');
  }
  if (Object.keys(parsed.data).length === 0) return invalidInput('Nothing to update.');

  const { invited, ...rest } = parsed.data;
  const updated = await prisma.unregisteredResident.update({
    where: { id },
    data: { ...rest, ...(invited !== undefined ? { invitedAt: invited ? new Date() : null } : {}) },
  });
  return ok(updated);
}

/** Removes an UnregisteredResident directory entry outright — there's no
 *  underlying record to preserve elsewhere (unlike a shared Contact's
 *  remove-from-directory, which unpublishes rather than deletes), since
 *  this row only ever existed for the directory in the first place. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.unregisteredResident.findUnique({ where: { id } });
  if (!entry) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: entry.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  await prisma.unregisteredResident.delete({ where: { id } });
  return ok(null);
}
