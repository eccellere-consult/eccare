import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  role: z.enum(['member', 'committee', 'admin']).optional(),
  flatNumber: z.string().max(40).nullable().optional(),
  // Corrects the resident's actual account name (User.name) — e.g. a typo made at
  // registration, or a placeholder like "Test Resident" left over from onboarding.
  // Deliberately a real account-wide rename, not a community-local display override:
  // the same trust level that already lets a committee/admin promote/demote/remove
  // a member covers fixing how their name is spelled everywhere they use EC.
  name: z.string().trim().min(1).max(100).optional(),
});

const forbidden = (message: string) =>
  NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 });

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Member not found.' } },
    { status: 404 },
  );

/**
 * Change a member's role and/or flat/house number within their community.
 * Promoting a resident to `committee` (or demoting them back), and editing
 * anyone's flat number, is something any committee/admin member can do —
 * that's the whole point of this route, since nothing elsewhere lets a
 * community self-manage this. Granting or removing `admin` status is more
 * sensitive — that's restricted to existing admins (a community's own
 * admin-role member, or a platform admin acting through the
 * requireMembership() bypass) — and a community can never be left with zero
 * admins, or nobody could manage it again.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please choose a valid role, name, or flat number.');
  if (parsed.data.role === undefined && parsed.data.flatNumber === undefined && parsed.data.name === undefined) {
    return invalidInput('Nothing to update.');
  }

  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: target.neighborhoodId });
  if (guard.error) return guard.error;

  const callerIsAdminTier = guard.membership.role === 'admin';
  const touchesAdmin = parsed.data.role === 'admin' || target.role === 'admin';
  if (parsed.data.role !== undefined && touchesAdmin && !callerIsAdminTier) {
    return forbidden('Only a community admin can grant or remove admin status.');
  }

  if (parsed.data.role !== undefined && target.role === 'admin' && parsed.data.role !== 'admin') {
    const otherAdmins = await prisma.neighborhoodMember.count({
      where: { neighborhoodId: target.neighborhoodId, role: 'admin', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAST_ADMIN',
            message: 'A community must keep at least one admin. Promote someone else to admin first.',
          },
        },
        { status: 400 },
      );
    }
  }

  const memberUpdateData = {
    ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    ...(parsed.data.flatNumber !== undefined ? { flatNumber: parsed.data.flatNumber } : {}),
  };

  // Name lives on User, not NeighborhoodMember — when both are being changed,
  // run them as one transaction so a mid-write failure can't leave the two out of
  // sync (e.g. role updated but the name change silently dropped).
  const updated =
    parsed.data.name !== undefined
      ? (
          await prisma.$transaction([
            prisma.user.update({ where: { id: target.userId }, data: { name: parsed.data.name } }),
            prisma.neighborhoodMember.update({
              where: { id },
              data: memberUpdateData,
              include: { user: { select: { id: true, name: true, phone: true } } },
            }),
          ])
        )[1]
      : await prisma.neighborhoodMember.update({
          where: { id },
          data: memberUpdateData,
          include: { user: { select: { id: true, name: true, phone: true } } },
        });

  return ok(updated);
}

/**
 * Remove a member from the community entirely (not the same as demoting them —
 * this deletes the NeighborhoodMember row, so they'd need to rejoin by join code
 * to come back). Committee/admin only, same guard as PATCH; a community can never
 * be left with zero admins, same rule as demoting the last admin above.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: target.neighborhoodId });
  if (guard.error) return guard.error;

  if (target.role === 'admin' && guard.membership.role !== 'admin') {
    return forbidden('Only a community admin can remove another admin.');
  }

  if (target.role === 'admin') {
    const otherAdmins = await prisma.neighborhoodMember.count({
      where: { neighborhoodId: target.neighborhoodId, role: 'admin', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAST_ADMIN',
            message: 'A community must keep at least one admin. Promote someone else to admin first.',
          },
        },
        { status: 400 },
      );
    }
  }

  await prisma.neighborhoodMember.delete({ where: { id } });
  return ok({ deleted: true });
}
