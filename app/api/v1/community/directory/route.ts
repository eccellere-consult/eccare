import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok, compareByFlatNumberAsc } from '@/lib/community-route';
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

  // A community's own committee/admin, or a platform admin (who reaches this same
  // 'admin' role via requireMembership()'s bypass), can manage every entry — not
  // just ones they personally added. Ordinary residents still only manage their own
  // shared contacts, via the canAccessElder check below.
  const isManager = guard.membership.role === 'committee' || guard.membership.role === 'admin';

  const [membersUnsorted, sharedContacts] = await Promise.all([
    prisma.neighborhoodMember.findMany({
      where: { neighborhoodId: guard.neighborhoodId, showInDirectory: true },
      include: {
        user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' }, // tiebreaker when flat numbers are equal or both unset
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

  // MySQL can't natural-sort "2" before "10" for an arbitrary alphanumeric column,
  // so registered members are re-sorted here by house/flat number ascending.
  const members = [...membersUnsorted].sort(compareByFlatNumberAsc);

  const memberEntries = members.map((m) => ({
    id: `member:${m.user.id}`,
    userId: m.user.id,
    contactId: null,
    memberId: m.id,
    name: m.user.name,
    // Phone is deliberately included — "call direct" is the point of the directory,
    // and it's already scoped to fellow members who opted in.
    phone: m.user.phone,
    avatarUrl: m.user.avatarUrl,
    flatNumber: m.flatNumber,
    role: m.role,
    isSelf: m.user.id === guard.auth.userId,
    source: 'member' as const,
    // Editing here means the flat/house number (via PATCH /community/members/[id]);
    // role changes stay on the dedicated member-management page. Deleting removes
    // the membership entirely — they'd need to rejoin by join code.
    canManage: isManager,
    canModerate: false,
  }));

  const contactEntries = await Promise.all(
    sharedContacts.map(async (c) => ({
      id: `contact:${c.id}`,
      userId: null,
      contactId: c.id,
      memberId: null,
      name: c.name,
      phone: c.phone,
      avatarUrl: null,
      flatNumber: null,
      role: null,
      isSelf: false,
      source: 'contact' as const,
      // Full edit/delete of the actual contact record — same authorization as the
      // Contacts page itself (canAccessElder). Never true for a manager who isn't
      // also family — a moderator shouldn't be able to rename or delete someone
      // else's private contact-book entry outright.
      canManage: await canAccessElder(guard.auth.userId, c.elderUserId),
      // A community's own committee/admin (or platform admin) can instead moderate
      // what's published in *their* directory — remove-from-directory only (see
      // DELETE /api/v1/community/directory/[contactId], which unpublishes rather
      // than deleting the owner's personal contact).
      canModerate: isManager,
    })),
  );

  return ok([...memberEntries, ...contactEntries]);
}
