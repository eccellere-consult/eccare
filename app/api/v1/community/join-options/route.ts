import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ok } from '@/lib/community-route';
import { commonHousePrefix } from '@/lib/house-location';

/** The registered communities a signed-in person can choose from when joining, instead of
 *  typing a code. Only communities that already have a committee or admin are offered, so every
 *  request made from this list is approved by a person who knows the neighbourhood — a brand-new
 *  community with nobody to approve is joined with its code only. Communities in the person's own
 *  pin code or city come first. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { pincode: true, city: true } });

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
      members: { where: { status: { in: ['approved', 'pending'] } }, select: { userId: true, status: true, flatNumber: true } },
    },
    take: 60,
  });

  const rows = communities
    .map((c) => {
      const approved = c.members.filter((m) => m.status === 'approved');
      const mine = c.members.find((m) => m.userId === auth.userId);
      const near = (me?.pincode && c.pincode === me.pincode ? 2 : 0) + (me?.city && c.city && c.city.toLowerCase() === me.city.toLowerCase() ? 1 : 0);
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        pincode: c.pincode,
        description: c.description,
        memberCount: approved.length,
        housePrefix: commonHousePrefix(approved.map((m) => m.flatNumber)),
        joined: mine ? (mine.status as 'approved' | 'pending') : null,
        near,
      };
    })
    .sort((a, b) => b.near - a.near || b.memberCount - a.memberCount || a.name.localeCompare(b.name))
    .slice(0, 30)
    .map(({ near, ...rest }) => ({ ...rest, nearYou: near > 0 }));

  return ok(rows);
}
