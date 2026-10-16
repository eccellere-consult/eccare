import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizeHouseInput } from '@/lib/house';
import { communityHousePrefix, pinHouseIfMissing } from '@/lib/house-location';
import { reconcileMemberWithDirectory } from '@/lib/directory-link';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  neighborhoodId: z.string().min(1),
  role: z.enum(['member', 'committee', 'admin']).default('member'),
  users: z.array(z.object({ userId: z.string().min(1), house: z.string().max(40) })).min(1).max(200),
});

export interface AllocationResult {
  userId: string;
  name: string;
  status: 'allocated' | 'approved' | 'skipped';
  reason?: string;
  house?: string;
}

/** Platform admin: puts registered people into a community, approved straight away — for
 *  people who registered but never joined one, and for approving a pending join request from
 *  the user list. A house is required for each person (the same rule as joining); a bare number
 *  gets the community's usual block prefix. Any directory entry that matches the person is linked,
 *  and a location they shared with a pending request becomes their house's pin. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Only platform admins can do this.', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('VALIDATION', 'Choose a community and at least one person.');
  const { neighborhoodId, role, users } = parsed.data;

  const neighborhood = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { id: true, name: true, housePrefix: true, members: { where: { status: 'approved' }, select: { flatNumber: true } } },
  });
  if (!neighborhood) return fail('NOT_FOUND', 'That community could not be found.', 404);
  const defaultBlock = communityHousePrefix(neighborhood.housePrefix, neighborhood.members.map((m) => m.flatNumber)) ?? undefined;

  const accounts = await prisma.user.findMany({
    where: { id: { in: users.map((u) => u.userId) } },
    select: { id: true, name: true, role: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const results: AllocationResult[] = [];
  for (const entry of users) {
    const account = byId.get(entry.userId);
    if (!account) {
      results.push({ userId: entry.userId, name: 'Unknown account', status: 'skipped', reason: 'That account no longer exists.' });
      continue;
    }
    const skip = (reason: string) => results.push({ userId: account.id, name: account.name, status: 'skipped', reason });

    if (account.role !== 'elder' && account.role !== 'caregiver') {
      skip('Only elders and family members can belong to a community.');
      continue;
    }
    const house = normalizeHouseInput(entry.house, { defaultBlock });
    if (!house.ok) {
      skip(house.message);
      continue;
    }

    const existing = await prisma.neighborhoodMember.findUnique({
      where: { neighborhoodId_userId: { neighborhoodId, userId: account.id } },
    });
    if (existing?.status === 'approved') {
      skip('Already a member of this community.');
      continue;
    }

    const data = {
      role,
      flatNumber: house.value,
      status: 'approved' as const,
      approvedAt: new Date(),
      approvedById: auth.userId,
      rejectionReason: null,
      joinLat: null,
      joinLng: null,
    };
    if (existing) await prisma.neighborhoodMember.update({ where: { id: existing.id }, data });
    else await prisma.neighborhoodMember.create({ data: { neighborhoodId, userId: account.id, ...data } });

    // A location shared with a pending request becomes the house's pin (if it has none yet).
    if (existing?.joinLat != null && existing.joinLng != null) {
      await pinHouseIfMissing({
        neighborhoodId,
        house: house.value,
        userId: account.id,
        lat: Number(existing.joinLat),
        lng: Number(existing.joinLng),
      }).catch(() => false);
    }
    // Link the person to a directory entry the committee may already have for them.
    try {
      await reconcileMemberWithDirectory(neighborhoodId, account.id);
    } catch (err) {
      console.error('[directory-link] reconcile failed:', err instanceof Error ? err.message : err);
    }

    results.push({ userId: account.id, name: account.name, status: existing?.status === 'pending' ? 'approved' : 'allocated', house: house.value });
  }

  return NextResponse.json({
    success: true,
    data: {
      community: neighborhood.name,
      done: results.filter((r) => r.status !== 'skipped').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
    },
  });
}
