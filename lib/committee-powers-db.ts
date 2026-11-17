import { prisma } from '@/lib/db';
import { powersOf, type MemberRole, type Powers, type CommitteeSettings } from '@/lib/committee-powers';

/** The community's switches plus what the caller may do, read fresh from the database each time. */
export async function loadPowers(
  userId: string,
  neighborhoodId: string,
  role: MemberRole,
): Promise<{ powers: Powers; settings: CommitteeSettings; delegatedUntil: Date | null }> {
  const [neighborhood, member] = await Promise.all([
    prisma.neighborhood.findUnique({
      where: { id: neighborhoodId },
      select: { committeeCanManageCommittee: true, committeeCanRemoveMembers: true },
    }),
    // A platform admin acting through requireMembership() has no row; role 'admin' covers them.
    prisma.neighborhoodMember.findUnique({
      where: { neighborhoodId_userId: { neighborhoodId, userId } },
      select: { adminDelegatedUntil: true },
    }),
  ]);
  const settings: CommitteeSettings = {
    committeeCanManageCommittee: neighborhood?.committeeCanManageCommittee ?? false,
    committeeCanRemoveMembers: neighborhood?.committeeCanRemoveMembers ?? false,
  };
  const delegatedUntil = member?.adminDelegatedUntil ?? null;
  return { powers: powersOf({ role, adminDelegatedUntil: delegatedUntil }, settings), settings, delegatedUntil };
}
