import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok, compareByFlatNumberAsc } from '@/lib/community-route';

/** Every member of the community — committee/admin only. Unlike the public
 *  directory (`/community/directory`), this ignores `showInDirectory` opt-outs:
 *  managers need to see and act on the full membership regardless of a
 *  resident's privacy preference. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const membersUnsorted = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'asc' }, // tiebreaker when flat numbers are equal or both unset
  });

  // Same natural sort as /community/directory — house/flat number ascending, not
  // join order — so a manager scanning the list can actually find a flat quickly.
  const members = [...membersUnsorted].sort(compareByFlatNumberAsc);

  return ok(
    members.map((m) => ({
      id: m.id,
      role: m.role,
      flatNumber: m.flatNumber,
      createdAt: m.createdAt,
      user: m.user,
    })),
  );
}
