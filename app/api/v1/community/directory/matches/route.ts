import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Possible matches between a newly joined member and a directory entry that the
 *  system couldn't settle on its own (not the same phone number) — committee/admin
 *  only. Each one is "is this member that directory entry?" for a human to decide;
 *  see lib/directory-link.ts for what counts as plausible. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const suggestions = await prisma.directoryMatchSuggestion.findMany({
    where: { neighborhoodId: guard.neighborhoodId, status: 'pending', placeholder: { claimedByUserId: null } },
    include: { placeholder: { select: { id: true, name: true, phone: true, flatNumber: true } } },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
  });
  if (suggestions.length === 0) return ok([]);

  const members = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: guard.neighborhoodId, userId: { in: [...new Set(suggestions.map((s) => s.userId))] } },
    select: { userId: true, flatNumber: true, status: true, user: { select: { name: true, phone: true } } },
  });
  const memberByUser = new Map(members.map((m) => [m.userId, m]));

  return ok(
    suggestions
      .filter((s) => memberByUser.has(s.userId)) // the member left since — nothing to decide
      .map((s) => {
        const m = memberByUser.get(s.userId)!;
        return {
          id: s.id,
          reason: s.reason,
          member: { name: m.user.name, phone: m.user.phone, flatNumber: m.flatNumber, status: m.status },
          entry: s.placeholder,
        };
      }),
  );
}
