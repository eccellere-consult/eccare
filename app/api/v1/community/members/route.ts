import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Every member of the community — committee/admin only. Unlike the public
 *  directory (`/community/directory`), this ignores `showInDirectory` opt-outs:
 *  managers need to see and act on the full membership regardless of a
 *  resident's privacy preference. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const members = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

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
