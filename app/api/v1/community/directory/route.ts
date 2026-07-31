import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Neighbour directory. Only members can read it, and only members who haven't opted
 *  out of the directory appear in it. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const members = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: guard.neighborhoodId, showInDirectory: true },
    include: {
      user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return ok(
    members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      // Phone is deliberately included — "call direct" is the point of the directory,
      // and it's already scoped to fellow members who opted in.
      phone: m.user.phone,
      avatarUrl: m.user.avatarUrl,
      flatNumber: m.flatNumber,
      role: m.role,
      isSelf: m.user.id === guard.auth.userId,
    })),
  );
}
