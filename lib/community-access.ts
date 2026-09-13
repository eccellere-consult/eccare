import { prisma } from '@/lib/db';
import type { NeighborhoodRole } from '@prisma/client';
import { canAccessElder } from '@/lib/family-access';

export interface Membership {
  neighborhoodId: string;
  role: NeighborhoodRole;
}

/**
 * The caller's membership in a neighbourhood, or null if they aren't a member.
 *
 * Every community route must gate on this. Community data is only visible to people
 * who actually live there — there is no public/global read path, by design.
 */
export async function getMembership(
  userId: string,
  neighborhoodId: string,
): Promise<Membership | null> {
  const member = await prisma.neighborhoodMember.findUnique({
    where: { neighborhoodId_userId: { neighborhoodId, userId } },
    select: { neighborhoodId: true, role: true, status: true },
  });
  // A pending or rejected row grants nothing — it isn't a real membership yet
  // (or wasn't approved). See requireMembership for the caller-facing
  // PENDING_APPROVAL distinction.
  if (!member || member.status !== 'approved') return null;
  return member;
}

/** True if the caller is a member of the neighbourhood in any capacity. */
export async function isMember(userId: string, neighborhoodId: string): Promise<boolean> {
  return (await getMembership(userId, neighborhoodId)) !== null;
}

/**
 * True if the caller can act on behalf of the community — post announcements, manage
 * helplines, answer committee queries, etc. Ordinary members can read those things
 * but not author them.
 */
export async function canManageCommunity(
  userId: string,
  neighborhoodId: string,
): Promise<boolean> {
  const member = await getMembership(userId, neighborhoodId);
  return member?.role === 'committee' || member?.role === 'admin';
}

/**
 * The caller's primary neighbourhood, used when a request doesn't name one explicitly
 * (the common case — most residents belong to exactly one). Returns null if they
 * haven't joined any yet, which the UI treats as "show the join screen".
 */
export async function getPrimaryNeighborhoodId(userId: string): Promise<string | null> {
  const member = await prisma.neighborhoodMember.findFirst({
    where: { userId, status: 'approved' },
    orderBy: { createdAt: 'asc' },
    select: { neighborhoodId: true },
  });
  return member?.neighborhoodId ?? null;
}

/**
 * The ELDER's primary neighbourhood, for a caregiver viewing on the elder's behalf —
 * distinct from getPrimaryNeighborhoodId, which always resolves the caller's own.
 *
 * Deliberately narrow and isolated: used only by the two read-only "For [Elder]"
 * community routes (notices, directory), never by requireMembership itself. Those
 * ~49 other community routes have no elder concept and this helper must not change
 * that — a caregiver's own community membership stays entirely independent of any
 * elder's. Returns null if the caller can't access this elder, or the elder hasn't
 * joined a neighbourhood — both cases the caller treats as "nothing to show".
 */
export async function getElderNeighborhoodId(
  callerId: string,
  elderUserId: string,
): Promise<string | null> {
  if (!(await canAccessElder(callerId, elderUserId))) return null;
  return getPrimaryNeighborhoodId(elderUserId);
}
