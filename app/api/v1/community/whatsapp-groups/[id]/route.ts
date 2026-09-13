import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } },
    { status: 404 },
  );

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(1000).optional().nullable(),
  inviteUrl: z.string().url().refine((u) => /^https:\/\/chat\.whatsapp\.com\//i.test(u), {
    message: 'Must be a WhatsApp group invite link (https://chat.whatsapp.com/...)',
  }).optional(),
});

/** Edit a WhatsApp group link — same committee-only trust gate as adding one
 *  (see POST's own comment in ../route.ts): an invite link grants access to
 *  an off-platform space EC can't moderate. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.whatsAppGroupLink.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return invalidInput(parsed.error?.issues?.[0]?.message || 'Please check the details and try again.');
  }
  if (Object.keys(parsed.data).length === 0) return invalidInput('Nothing to update.');

  const updated = await prisma.whatsAppGroupLink.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

/** Remove a WhatsApp group link — committee/admin only, same as adding one. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.whatsAppGroupLink.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  await prisma.whatsAppGroupLink.delete({ where: { id } });

  return ok(null);
}
