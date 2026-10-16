import { prisma } from '@/lib/db';
import { houseKey } from '@/lib/house';

/** Saves where a house is — but only if nobody has pinned that house yet. Used when someone
 *  shares their location while joining: a location the committee already set (or a neighbour in
 *  the same house set earlier) is never overwritten by a join request. Returns whether it saved. */
export async function pinHouseIfMissing(opts: {
  neighborhoodId: string;
  house: string;
  lat: number;
  lng: number;
  userId: string;
}): Promise<boolean> {
  const key = houseKey(opts.house);
  if (!key) return false;
  const existing = await prisma.houseLocation.findUnique({
    where: { neighborhoodId_houseKey: { neighborhoodId: opts.neighborhoodId, houseKey: key } },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.houseLocation.create({
    data: {
      neighborhoodId: opts.neighborhoodId,
      houseKey: key,
      house: opts.house,
      lat: opts.lat,
      lng: opts.lng,
      setById: opts.userId,
      setByRole: 'member',
    },
  });
  return true;
}

/** The block or association most houses in a community share ("KGRA" for KGRA-27, KGRA-29 …), so a
 *  person can type just "27" and have it completed. Needs at least two houses agreeing. */
export function commonHousePrefix(houses: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const h of houses) {
    const m = /^([A-Z][A-Z0-9]{0,9})-\d{1,6}[A-Z]?$/.exec((h ?? '').trim().toUpperCase());
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

/** The prefix a community's houses are written with: the one set when the community was registered,
 *  or — for communities that never set one — the block most of its houses already share. */
export function communityHousePrefix(stored: string | null | undefined, houses: Array<string | null>): string | null {
  return stored || commonHousePrefix(houses);
}
