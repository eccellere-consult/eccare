import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  compensation: z.string().max(120).optional(),
  contactPhone: z.string().min(3).max(20).optional(),
  preferredContactTime: z.string().max(120).optional(),
  status: z.enum(['active', 'closed']).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Posting not found.' } },
    { status: 404 },
  );

/** Owner edits their own posting; committee/admin can also moderate. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const posting = await prisma.communityJobPosting.findUnique({ where: { id } });
  if (!posting) return notFound();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: posting.neighborhoodId });
  if (guard.error) return guard.error;

  const isOwner = guard.auth.userId === posting.postedById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isOwner && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own posting.' } },
      { status: 403 },
    );
  }

  const updated = await prisma.communityJobPosting.update({ where: { id }, data: parsed.data });

  return ok(updated);
}

/** Owner deletes their own posting; committee/admin can remove any (moderation). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const posting = await prisma.communityJobPosting.findUnique({ where: { id } });
  if (!posting) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: posting.neighborhoodId });
  if (guard.error) return guard.error;

  const isOwner = guard.auth.userId === posting.postedById;
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isOwner && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You can only remove your own posting.' } },
      { status: 403 },
    );
  }

  await prisma.communityJobPosting.delete({ where: { id } });

  return ok(null);
}
