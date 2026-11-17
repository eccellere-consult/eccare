import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { loadPowers } from '@/lib/committee-powers-db';

/**
 * What the committee of this community is allowed to do, and what the caller may do.
 * Anyone on the committee can read it (the screens use it to show or hide buttons);
 * only the community's own admin can change the two switches.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const { powers, settings, delegatedUntil } = await loadPowers(guard.auth.userId, guard.neighborhoodId, guard.membership.role);
  return ok({
    committeeCanManageCommittee: settings.committeeCanManageCommittee,
    committeeCanRemoveMembers: settings.committeeCanRemoveMembers,
    you: { userId: guard.auth.userId, ...powers, delegatedUntil: powers.isActingAdmin ? delegatedUntil : null },
  });
}

const schema = z.object({
  committeeCanManageCommittee: z.boolean().optional(),
  committeeCanRemoveMembers: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidInput('Please choose on or off.');
  if (parsed.data.committeeCanManageCommittee === undefined && parsed.data.committeeCanRemoveMembers === undefined) {
    return invalidInput('Nothing to update.');
  }

  // Only the real admin: a committee member (even one holding lent powers) cannot widen their own rights.
  const { powers } = await loadPowers(guard.auth.userId, guard.neighborhoodId, guard.membership.role);
  if (!powers.canAdminister) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only the community admin can change what the committee may do.' } },
      { status: 403 },
    );
  }

  const updated = await prisma.neighborhood.update({
    where: { id: guard.neighborhoodId },
    data: {
      ...(parsed.data.committeeCanManageCommittee !== undefined
        ? { committeeCanManageCommittee: parsed.data.committeeCanManageCommittee }
        : {}),
      ...(parsed.data.committeeCanRemoveMembers !== undefined
        ? { committeeCanRemoveMembers: parsed.data.committeeCanRemoveMembers }
        : {}),
    },
    select: { committeeCanManageCommittee: true, committeeCanRemoveMembers: true },
  });
  return ok(updated);
}
