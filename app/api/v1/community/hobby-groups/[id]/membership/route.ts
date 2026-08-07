import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } },
    { status: 404 },
  );

/** Join a hobby group — any community member, idempotent (joining twice is a no-op,
 *  not an error — a double-tap shouldn't surface a confusing failure). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.hobbyGroup.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId });
  if (guard.error) return guard.error;

  await prisma.hobbyGroupMember.upsert({
    where: { hobbyGroupId_userId: { hobbyGroupId: id, userId: guard.auth.userId } },
    update: {},
    create: { hobbyGroupId: id, userId: guard.auth.userId },
  });

  return ok({ joined: true });
}

/** Leave a hobby group. The creator leaving doesn't delete or reassign the group —
 *  same "record stays, only the relation changes" posture as every other
 *  membership-style model in this app. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.hobbyGroup.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId });
  if (guard.error) return guard.error;

  await prisma.hobbyGroupMember.deleteMany({ where: { hobbyGroupId: id, userId: guard.auth.userId } });

  return ok({ joined: false });
}
