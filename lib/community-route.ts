import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getMembership, getPrimaryNeighborhoodId, type Membership } from '@/lib/community-access';

type Guard =
  | { error: NextResponse; auth?: never; neighborhoodId?: never; membership?: never }
  | { error?: never; auth: { userId: string; role: string }; neighborhoodId: string; membership: Membership };

function fail(code: string, message: string, status: number): { error: NextResponse } {
  return { error: NextResponse.json({ success: false, error: { code, message } }, { status }) };
}

/**
 * Single gate for every community route: authenticates the caller, resolves which
 * neighbourhood the request is about, and confirms they're actually a member of it.
 *
 * Neighbourhood resolution order: explicit `neighborhoodId` argument (from a parsed
 * request body) → `?neighborhoodId=` query param → the caller's primary neighbourhood.
 * Most residents belong to exactly one, so the common case needs no explicit id.
 *
 * Pass `manage: true` for actions only the committee/admin may perform (posting
 * announcements, managing helplines, resolving queries). Ordinary members can read
 * those surfaces but not author them.
 */
export async function requireMembership(
  req: NextRequest,
  opts: { manage?: boolean; neighborhoodId?: string } = {},
): Promise<Guard> {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const neighborhoodId =
    opts.neighborhoodId ||
    req.nextUrl.searchParams.get('neighborhoodId') ||
    (await getPrimaryNeighborhoodId(auth.userId));

  if (!neighborhoodId) {
    return fail('NO_COMMUNITY', "You haven't joined a community yet.", 404);
  }

  // Platform admins manage communities they haven't personally joined, so they don't
  // have a NeighborhoodMember row to look up. Grant them the same authority as a
  // community's own `admin`-role member instead of requiring a real membership row —
  // but still confirm the neighborhood exists, so a bad id 404s instead of every
  // downstream `findMany` silently returning an empty list.
  let membership: Membership | null = auth.role === 'admin' ? { neighborhoodId, role: 'admin' } : null;
  if (membership) {
    const exists = await prisma.neighborhood.findUnique({ where: { id: neighborhoodId }, select: { id: true } });
    if (!exists) return fail('NOT_FOUND', 'Community not found.', 404);
  } else {
    membership = await getMembership(auth.userId, neighborhoodId);
  }
  if (!membership) {
    return fail('NOT_A_MEMBER', 'You are not a member of this community.', 403);
  }

  if (opts.manage && membership.role !== 'committee' && membership.role !== 'admin') {
    return fail('FORBIDDEN', 'Only the management committee can do this.', 403);
  }

  return { auth, neighborhoodId, membership };
}

export const invalidInput = (message = 'Please check the details and try again.') =>
  NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message } }, { status: 400 });

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
