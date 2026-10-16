import { prisma } from '@/lib/db';
import { communityHousePrefix } from '@/lib/house-location';

export interface CommunityOptionRow {
  id: string;
  name: string;
  city: string | null;
  pincode: string | null;
  description: string | null;
  memberCount: number;
  /** The block or association every house is written with ("KGRA"), so a person only types the number. */
  housePrefix: string | null;
  /** Set only for a signed-in person who already asked to join, or is in, this community. */
  joined: 'approved' | 'pending' | null;
  nearYou: boolean;
}

/** The registered communities a person can choose from, instead of typing a code. Only communities
 *  that already have a committee or admin are offered, so every request made from this list is
 *  approved by someone who knows the neighbourhood — a brand-new community with nobody to approve is
 *  joined with its code only. Communities in the person's own pin code or city come first.
 *
 *  Used while signed in (the join page) and while registering (no account yet — then `me` is empty and
 *  nothing is personal: just names, places and the house prefix). */
export async function listJoinableCommunities(opts: {
  q?: string;
  me?: { userId: string; pincode: string | null; city: string | null };
}): Promise<CommunityOptionRow[]> {
  const q = (opts.q ?? '').trim();
  const me = opts.me;

  const communities = await prisma.neighborhood.findMany({
    where: {
      members: { some: { status: 'approved', role: { in: ['committee', 'admin'] } } },
      ...(q
        ? { OR: [{ name: { contains: q } }, { city: { contains: q } }, { pincode: { startsWith: q } }, { description: { contains: q } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      city: true,
      pincode: true,
      description: true,
      housePrefix: true,
      members: { where: { status: { in: ['approved', 'pending'] } }, select: { userId: true, status: true, flatNumber: true } },
    },
    take: 60,
  });

  return communities
    .map((c) => {
      const approved = c.members.filter((m) => m.status === 'approved');
      const mine = me ? c.members.find((m) => m.userId === me.userId) : undefined;
      const near = (me?.pincode && c.pincode === me.pincode ? 2 : 0) + (me?.city && c.city && c.city.toLowerCase() === me.city.toLowerCase() ? 1 : 0);
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        pincode: c.pincode,
        description: c.description,
        memberCount: approved.length,
        housePrefix: communityHousePrefix(c.housePrefix, approved.map((m) => m.flatNumber)),
        joined: mine ? (mine.status as 'approved' | 'pending') : null,
        near,
      };
    })
    .sort((a, b) => b.near - a.near || b.memberCount - a.memberCount || a.name.localeCompare(b.name))
    .slice(0, 30)
    .map(({ near, ...rest }) => ({ ...rest, nearYou: near > 0 }));
}
