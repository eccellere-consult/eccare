import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok, compareByFlatNumberAsc } from '@/lib/community-route';

/** Directory entries from the bulk directory import who haven't registered yet,
 *  with their invite status — committee/admin only, since it's the working list
 *  for sending WhatsApp invites (the Local Directory itself deliberately doesn't
 *  expose invitedAt to ordinary residents).
 *
 *  Anyone whose phone now matches a registered member of this community is left
 *  out: they did what the invite asked, so they're no longer "pending" — and the
 *  directory already shows them as a real member. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const [entries, memberPhones] = await Promise.all([
    prisma.unregisteredResident.findMany({
      where: { neighborhoodId: guard.neighborhoodId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.neighborhoodMember
      .findMany({
        where: { neighborhoodId: guard.neighborhoodId, user: { phone: { not: null } } },
        select: { user: { select: { phone: true } } },
      })
      .then((rows) => new Set(rows.map((r) => r.user.phone))),
  ]);

  const pending = entries
    .filter((e) => !e.phone || !memberPhones.has(e.phone))
    .sort(compareByFlatNumberAsc);

  return ok(
    pending.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      flatNumber: e.flatNumber,
      invitedAt: e.invitedAt,
    })),
  );
}
