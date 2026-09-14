import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok, compareByFlatNumberAsc } from '@/lib/community-route';
import { canAccessElder } from '@/lib/family-access';
import { getAuthUser } from '@/lib/auth';
import { getElderNeighborhoodId } from '@/lib/community-access';

/** Neighbour directory. Only members can read it, and only members who haven't opted
 *  out of the directory appear in it. Combines three sources:
 *  - registered NeighborhoodMember rows;
 *  - personal "neighbor" contacts an elder or their family opted to share (see
 *    Contact.shareWithNeighbours) — a phone-book entry someone typed in by hand
 *    rather than a registered account, scoped to the same community via the
 *    elder's own membership;
 *  - UnregisteredResident rows — an admin's bulk directory-only import (see
 *    lib/directory-import.ts), for people with no EC account at all. Unlike the
 *    other two, committee/admin fully manage these (edit/delete), since there's
 *    no owner to defer to.
 *
 *  With ?elderUserId=, a caregiver reads THEIR elder's directory instead of their
 *  own — read-only (no favoriting, managing, or moderating "as" the elder), and
 *  deliberately bypasses requireMembership. See getElderNeighborhoodId. */
export async function GET(req: NextRequest) {
  const elderUserId = req.nextUrl.searchParams.get('elderUserId');
  if (elderUserId) {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
    }
    const neighborhoodId = await getElderNeighborhoodId(auth.userId, elderUserId);
    if (neighborhoodId === null) {
      if (!(await canAccessElder(auth.userId, elderUserId))) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this elder.' } }, { status: 403 });
      }
      return ok([]); // elder hasn't joined a community yet
    }

    const [membersUnsorted, sharedContacts, unregistered] = await Promise.all([
      prisma.neighborhoodMember.findMany({
        where: { neighborhoodId, showInDirectory: true },
        include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.contact.findMany({
        where: {
          category: 'neighbor',
          shareWithNeighbours: true,
          elderUser: { memberships: { some: { neighborhoodId } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.unregisteredResident.findMany({ where: { neighborhoodId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const members = [...membersUnsorted].sort(compareByFlatNumberAsc);

    const memberEntries = members.map((m) => ({
      id: `member:${m.user.id}`,
      userId: m.user.id,
      contactId: null,
      memberId: m.id,
      unregisteredId: null,
      name: m.user.name,
      phone: m.user.phone,
      avatarUrl: m.user.avatarUrl,
      flatNumber: m.flatNumber,
      role: m.role,
      isSelf: m.user.id === elderUserId,
      source: 'member' as const,
      isFavorite: false,
      // Read-only view: a caregiver browsing the elder's directory never gets
      // manage/moderate controls here, regardless of the elder's own role or
      // the caregiver's role in their own, unrelated community.
      canManage: false,
      canModerate: false,
    }));

    const contactEntries = sharedContacts.map((c) => ({
      id: `contact:${c.id}`,
      userId: null,
      contactId: c.id,
      memberId: null,
      unregisteredId: null,
      name: c.name,
      phone: c.phone,
      avatarUrl: null,
      flatNumber: null,
      role: null,
      isSelf: false,
      source: 'contact' as const,
      isFavorite: false,
      canManage: false,
      canModerate: false,
    }));

    const unregisteredEntries = unregistered.map((u) => ({
      id: `unregistered:${u.id}`,
      userId: null,
      contactId: null,
      memberId: null,
      unregisteredId: u.id,
      name: u.name,
      phone: u.phone,
      avatarUrl: null,
      flatNumber: u.flatNumber,
      role: null,
      isSelf: false,
      source: 'unregistered' as const,
      isFavorite: false,
      canManage: false,
      canModerate: false,
    }));

    return ok([...memberEntries, ...contactEntries, ...unregisteredEntries]);
  }

  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  // A community's own committee/admin, or a platform admin (who reaches this same
  // 'admin' role via requireMembership()'s bypass), manages the directory. Ordinary
  // residents get favourite/hello/call only, even for a contact they shared
  // themselves — see the contact-entry mapping below.
  const isManager = guard.membership.role === 'committee' || guard.membership.role === 'admin';

  const [membersUnsorted, sharedContacts, unregistered, favorites] = await Promise.all([
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
    prisma.unregisteredResident.findMany({
      where: { neighborhoodId: guard.neighborhoodId },
      orderBy: { createdAt: 'asc' },
    }),
    // The current viewer's own pins — personal, never visible to anyone else
    // looking at the same directory. See NeighborFavorite in schema.prisma.
    prisma.neighborFavorite.findMany({
      where: { userId: guard.auth.userId, neighborhoodId: guard.neighborhoodId },
      select: { entryKey: true },
    }),
  ]);
  const favoriteKeys = new Set(favorites.map((f) => f.entryKey));

  // MySQL can't natural-sort "2" before "10" for an arbitrary alphanumeric column,
  // so registered members are re-sorted here by house/flat number ascending.
  const members = [...membersUnsorted].sort(compareByFlatNumberAsc);

  const memberEntries = members.map((m) => ({
    id: `member:${m.user.id}`,
    userId: m.user.id,
    contactId: null,
    memberId: m.id,
    unregisteredId: null,
    name: m.user.name,
    // Phone is deliberately included — "call direct" is the point of the directory,
    // and it's already scoped to fellow members who opted in.
    phone: m.user.phone,
    avatarUrl: m.user.avatarUrl,
    flatNumber: m.flatNumber,
    role: m.role,
    isSelf: m.user.id === guard.auth.userId,
    source: 'member' as const,
    isFavorite: favoriteKeys.has(`member:${m.user.id}`),
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
      unregisteredId: null,
      name: c.name,
      phone: c.phone,
      avatarUrl: null,
      flatNumber: null,
      role: null,
      isSelf: false,
      source: 'contact' as const,
      isFavorite: favoriteKeys.has(`contact:${c.id}`),
      // The Local Directory itself is committee/admin-managed only — a resident who
      // shared their own contact no longer gets an edit/delete affordance for it
      // here (they can still manage the underlying contact from their own Contacts
      // page; canAccessElder still gates that route). Everyone else in the
      // directory gets favourite/hello/call only.
      canManage: false,
      // A community's own committee/admin (or platform admin) instead moderates
      // what's published in *their* directory — remove-from-directory only (see
      // DELETE /api/v1/community/directory/[contactId], which unpublishes rather
      // than deleting the owner's personal contact — a moderator still shouldn't be
      // able to rename or delete someone else's private contact-book entry outright).
      canModerate: isManager,
    })),
  );

  const unregisteredEntries = unregistered.map((u) => ({
    id: `unregistered:${u.id}`,
    userId: null,
    contactId: null,
    memberId: null,
    unregisteredId: u.id,
    name: u.name,
    phone: u.phone,
    avatarUrl: null,
    flatNumber: u.flatNumber,
    role: null,
    isSelf: false,
    source: 'unregistered' as const,
    isFavorite: favoriteKeys.has(`unregistered:${u.id}`),
    // No owner to defer to (unlike a shared Contact) — committee/admin fully
    // manage these: edit via PATCH /community/directory/unregistered/[id],
    // delete outright rather than just unpublish.
    canManage: isManager,
    canModerate: false,
  }));

  // Stable sort (Node's Array#sort has been stable since ES2019) — favorites float
  // to the top, everything else keeps its existing relative order underneath.
  const entries = [...memberEntries, ...contactEntries, ...unregisteredEntries].sort(
    (a, b) => Number(b.isFavorite) - Number(a.isFavorite),
  );

  return ok(entries);
}
