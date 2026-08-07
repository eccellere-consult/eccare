import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } },
    { status: 404 },
  );

/** Member list with contact info (name + phone) so a group can actually coordinate a
 *  meetup — gated to existing group members and committee/admin, not the whole
 *  community, since it's exposing phone numbers. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.hobbyGroup.findUnique({ where: { id } });
  if (!group) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: group.neighborhoodId });
  if (guard.error) return guard.error;

  const isMember = await prisma.hobbyGroupMember.findUnique({
    where: { hobbyGroupId_userId: { hobbyGroupId: id, userId: guard.auth.userId } },
  });
  const canManage = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  if (!isMember && !canManage) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Join the group to see its members.' } },
      { status: 403 },
    );
  }

  const members = await prisma.hobbyGroupMember.findMany({
    where: { hobbyGroupId: id },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return ok(members.map((m) => ({ id: m.user.id, name: m.user.name, phone: m.user.phone, joinedAt: m.joinedAt })));
}
