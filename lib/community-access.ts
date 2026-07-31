import { prisma } from '@/lib/db';
import type { NeighborhoodRole } from '@prisma/client';

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
    select: { neighborhoodId: true, role: true },
  });
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
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { neighborhoodId: true },
  });
  return member?.neighborhoodId ?? null;
}
