import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } },
    { status: 404 },
  );

/** Creator or committee/admin can edit. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.hobbyGroup.findUnique({ where: { id } });
  if (!group) return notFound();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId });
  if (guard.error) return guard.error;

  const isCreator = guard.auth.userId === group.createdById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isCreator && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only the group creator or committee can edit this.' } },
      { status: 403 },
    );
  }

  const updated = await prisma.hobbyGroup.update({ where: { id }, data: parsed.data });

  return ok(updated);
}

/** Creator or committee/admin can delete. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.hobbyGroup.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId });
  if (guard.error) return guard.error;

  const isCreator = guard.auth.userId === group.createdById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isCreator && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only the group creator or committee can remove this.' } },
      { status: 403 },
    );
  }

  await prisma.hobbyGroup.delete({ where: { id } });

  return ok(null);
}
