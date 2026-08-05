import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { canAccessElder } from '@/lib/family-access';

/** Neighbour directory. Only members can read it, and only members who haven't opted
 *  out of the directory appear in it. Alongside registered members, also surfaces
 *  personal "neighbor" contacts that an elder or their family opted to share (see
 *  Contact.shareWithNeighbours) — a phone-book entry someone typed in by hand rather
 *  than a registered account, scoped to the same community via the elder's own
 *  membership. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const [members, sharedContacts] = await Promise.all([
    prisma.neighborhoodMember.findMany({
      where: { neighborhoodId: guard.neighborhoodId, showInDirectory: true },
      include: {
        user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.contact.findMany({
      where: {
        category: 'neighbor',
        shareWithNeighbours: true,
        elderUser: { memberships: { some: { neighborhoodId: guard.neighborhoodId } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const memberEntries = members.map((m) => ({
    id: `member:${m.user.id}`,
    userId: m.user.id,
    contactId: null,
    name: m.user.name,
    // Phone is deliberately included — "call direct" is the point of the directory,
    // and it's already scoped to fellow members who opted in.
    phone: m.user.phone,
    avatarUrl: m.user.avatarUrl,
    flatNumber: m.flatNumber,
    role: m.role,
    isSelf: m.user.id === guard.auth.userId,
    source: 'member' as const,
    canManage: false,
  }));

  const contactEntries = await Promise.all(
    sharedContacts.map(async (c) => ({
      id: `contact:${c.id}`,
      userId: null,
      contactId: c.id,
      name: c.name,
      phone: c.phone,
      avatarUrl: null,
      flatNumber: null,
      role: null,
      isSelf: false,
      source: 'contact' as const,
      // Same authorization as the Contacts page itself (canAccessElder) — the elder or
      // any of their linked family members can manage it here, not only whoever
      // happened to click "add". Matches PATCH/DELETE /api/v1/contacts/[id] exactly, so
      // this never shows a control the API would then refuse.
      canManage: await canAccessElder(guard.auth.userId, c.elderUserId),
    })),
  );

  return ok([...memberEntries, ...contactEntries]);
}
