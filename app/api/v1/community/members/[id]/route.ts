import { pinHouseIfMissing } from '@/lib/house-location';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { normalizeHouseInput } from '@/lib/house';
import { COMMITTEE_TITLES, checkDelegationEnd } from '@/lib/committee-powers';
import { loadPowers } from '@/lib/committee-powers-db';

const schema = z.object({
  role: z.enum(['member', 'committee', 'admin']).optional(),
  flatNumber: z.string().max(40).nullable().optional(),
  // Corrects the resident's actual account name (User.name) — e.g. a typo made at
  // registration, or a placeholder like "Test Resident" left over from onboarding.
  // Deliberately a real account-wide rename, not a community-local display override:
  // the same trust level that already lets a committee/admin promote/demote/remove
  // a member covers fixing how their name is spelled everywhere they use EC.
  name: z.string().trim().min(1).max(100).optional(),
  // Deciding a pending join request — a separate concern from the edits above,
  // handled in its own branch below (see approve/reject handling).
  action: z.enum(['approve', 'reject']).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
  // President / Secretary / Treasurer (null clears it). One holder per title: giving it moves it.
  committeeTitle: z.enum(COMMITTEE_TITLES).nullable().optional(),
  // The admin lends admin powers to a committee member until this moment (null ends it now).
  delegateAdminUntil: z.string().max(40).nullable().optional(),
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

  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: target.neighborhoodId });
  if (guard.error) return guard.error;

  // Approving/rejecting a pending join request — same idiom as
  // CommunityProviderListing's approve/reject (app/api/v1/community/provider-requests/[id]/route.ts).
  if (parsed.data.action) {
    if (target.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'This request has already been decided.' } },
        { status: 409 },
      );
    }
    const updated = await prisma.neighborhoodMember.update({
      where: { id },
      data:
        parsed.data.action === 'approve'
          ? { status: 'approved', approvedAt: new Date(), approvedById: guard.auth.userId, rejectionReason: null }
          : { status: 'rejected', rejectionReason: parsed.data.rejectionReason ?? null },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
    // The location the person shared while asking to join becomes their house's pin on approval
    // (unless the house is already pinned), then it is no longer needed on the request.
    if (parsed.data.action === 'approve' && target.joinLat !== null && target.joinLng !== null && target.flatNumber) {
      await pinHouseIfMissing({
        neighborhoodId: target.neighborhoodId,
        house: target.flatNumber,
        userId: target.userId,
        lat: Number(target.joinLat),
        lng: Number(target.joinLng),
      }).catch(() => false);
    }
    if (target.joinLat !== null || target.joinLng !== null) {
      await prisma.neighborhoodMember.update({ where: { id }, data: { joinLat: null, joinLng: null } }).catch(() => {});
    }
    return ok(updated);
  }

  if (
    parsed.data.role === undefined &&
    parsed.data.flatNumber === undefined &&
    parsed.data.name === undefined &&
    parsed.data.committeeTitle === undefined &&
    parsed.data.delegateAdminUntil === undefined
  ) {
    return invalidInput('Nothing to update.');
  }

  // A house number is mandatory and always stored in the one structured form
  // (block/association + number, or a house name) — see lib/house.ts. Clearing it
  // isn't allowed.
  let flatNumber: string | undefined;
  if (parsed.data.flatNumber !== undefined) {
    const house = normalizeHouseInput(parsed.data.flatNumber);
    if (!house.ok) return invalidInput(house.message);
    flatNumber = house.value;
  }

  const { powers } = await loadPowers(guard.auth.userId, target.neighborhoodId, guard.membership.role);
  const roleChanging = parsed.data.role !== undefined && parsed.data.role !== target.role;
  const newRole = parsed.data.role ?? target.role;

  // Granting or removing ADMIN is the real admin's alone (an acting admin cannot, so a lent power
  // can never be turned into a permanent one). Making someone committee, or taking it away, needs
  // the admin to have switched that right on for the committee (or lent admin powers).
  if (roleChanging) {
    const touchesAdmin = parsed.data.role === 'admin' || target.role === 'admin';
    if (touchesAdmin && !powers.canAdminister) {
      return forbidden('Only a community admin can grant or remove admin status.');
    }
    if (!touchesAdmin && !powers.canManageCommittee) {
      return forbidden('Making someone committee, or taking it away, needs the community admin to allow it. Ask your admin to switch it on.');
    }
  }

  // President / Secretary / Treasurer: same right as making committee. Only committee or admin can hold one.
  if (parsed.data.committeeTitle !== undefined) {
    if (!powers.canManageCommittee) {
      return forbidden('Setting a committee title needs the community admin to allow it. Ask your admin to switch it on.');
    }
    if (parsed.data.committeeTitle !== null && newRole === 'member') {
      return invalidInput('Only a committee member can hold a title. Make them committee first.');
    }
  }

  // Lending admin powers for a while: the real admin only, to a committee member only.
  let delegation: { until: Date | null } | undefined;
  if (parsed.data.delegateAdminUntil !== undefined) {
    if (!powers.canAdminister) return forbidden('Only the community admin can lend admin powers.');
    if (parsed.data.delegateAdminUntil === null) {
      delegation = { until: null };
    } else {
      if (newRole !== 'committee') return invalidInput('Admin powers can be lent to a committee member only.');
      if (target.userId === guard.auth.userId) return invalidInput('You are the admin already.');
      const checked = checkDelegationEnd(parsed.data.delegateAdminUntil);
      if (!checked.ok) return invalidInput(checked.message);
      delegation = { until: checked.date };
    }
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

  // Becoming an ordinary member drops the office and any lent powers; becoming admin makes a lent
  // window pointless. An explicit title / delegation in the request wins over these defaults.
  const droppedToMember = roleChanging && newRole === 'member';
  const memberUpdateData = {
    ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    ...(flatNumber !== undefined ? { flatNumber } : {}),
    ...(droppedToMember ? { committeeTitle: null, adminDelegatedUntil: null, adminDelegatedById: null } : {}),
    ...(roleChanging && newRole === 'admin' ? { adminDelegatedUntil: null, adminDelegatedById: null } : {}),
    ...(parsed.data.committeeTitle !== undefined ? { committeeTitle: parsed.data.committeeTitle } : {}),
    ...(delegation
      ? { adminDelegatedUntil: delegation.until, adminDelegatedById: delegation.until ? guard.auth.userId : null }
      : {}),
  };
  const include = { user: { select: { id: true, name: true, phone: true } } };

  // One transaction for everything that has to stay in step: the name (on User), taking a title
  // off its previous holder (one per community), and the member row itself.
  const steps = [
    ...(parsed.data.name !== undefined
      ? [prisma.user.update({ where: { id: target.userId }, data: { name: parsed.data.name } })]
      : []),
    ...(parsed.data.committeeTitle
      ? [
          prisma.neighborhoodMember.updateMany({
            where: { neighborhoodId: target.neighborhoodId, committeeTitle: parsed.data.committeeTitle, id: { not: id } },
            data: { committeeTitle: null },
          }),
        ]
      : []),
  ];
  const results = await prisma.$transaction([
    ...steps,
    prisma.neighborhoodMember.update({ where: { id }, data: memberUpdateData, include }),
  ]);
  const updated = results[results.length - 1];

  return ok(updated);
}

/**
 * Remove a member from the community entirely (not the same as demoting them —
 * this deletes the NeighborhoodMember row, so they'd need to rejoin by join code
 * to come back). Committee/admin removing someone else, OR a member removing
 * their OWN row (self-serve "Leave this community") — either way, a community
 * can never be left with zero admins, same rule as demoting the last admin
 * above.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return notFound();

  // Authenticate + confirm the caller belongs to this same neighbourhood, without
  // yet requiring manage-tier — a self-leave doesn't need it, only removing
  // someone else does.
  const guard = await requireMembership(req, { neighborhoodId: target.neighborhoodId });
  if (guard.error) return guard.error;

  const isSelf = guard.auth.userId === target.userId;
  if (!isSelf) {
    if (guard.membership.role !== 'committee' && guard.membership.role !== 'admin') {
      return forbidden('Only the management committee can do this.');
    }
    // Removing someone is the easiest mistake to make, so the admin decides whether the committee may.
    const { powers } = await loadPowers(guard.auth.userId, target.neighborhoodId, guard.membership.role);
    if (!powers.canRemoveMembers) {
      return forbidden('Removing a resident needs the community admin to allow it. Ask your admin to switch it on.');
    }
    if (target.role === 'admin' && !powers.canAdminister) {
      return forbidden('Only a community admin can remove another admin.');
    }
    if (target.role === 'committee' && !powers.canManageCommittee) {
      return forbidden('Removing a committee member needs the community admin to allow it. Ask your admin to switch it on.');
    }
  }

  if (target.role === 'admin') {
    const otherAdmins = await prisma.neighborhoodMember.count({
      where: { neighborhoodId: target.neighborhoodId, role: 'admin', status: 'approved', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAST_ADMIN',
            message: isSelf
              ? 'You are the only admin. Promote someone else to admin before leaving.'
              : 'A community must keep at least one admin. Promote someone else to admin first.',
          },
        },
        { status: 400 },
      );
    }
  }

  await prisma.neighborhoodMember.delete({ where: { id } });
  return ok({ deleted: true });
}
