import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { houseKey, normalizeHouseInput } from '@/lib/house';
import { isValidLatLng } from '@/lib/geo';

const putSchema = z.object({
  neighborhoodId: z.string().optional(),
  // Which house. Omitted = the caller's own (from their membership). Naming a house
  // other than their own is a committee/admin action.
  house: z.string().max(40).optional(),
  lat: z.number(),
  lng: z.number(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Resolves which house a request is about and whether the caller may change it:
 *  their own always; anyone else's only for a committee/admin member. */
async function resolveHouse(
  req: NextRequest,
  neighborhoodId: string | undefined,
  house: string | undefined,
) {
  const guard = await requireMembership(req, { neighborhoodId });
  if (guard.error) return { error: guard.error };

  const isManager = guard.membership.role === 'committee' || guard.membership.role === 'admin';
  const own = await prisma.neighborhoodMember.findUnique({
    where: { neighborhoodId_userId: { neighborhoodId: guard.neighborhoodId, userId: guard.auth.userId } },
    select: { flatNumber: true },
  });

  const target = house ?? own?.flatNumber ?? '';
  if (!target) {
    return { error: fail('NO_HOUSE', 'Add your house number first, then pin its location.', 400) };
  }
  const key = houseKey(target);
  if (!key) return { error: fail('NO_HOUSE', 'Add a valid house number first.', 400) };

  const isOwnHouse = !!own?.flatNumber && houseKey(own.flatNumber) === key;
  if (!isOwnHouse && !isManager) {
    return { error: fail('FORBIDDEN', "Only the community's committee can set the location of another house.", 403) };
  }
  return { guard, key, isManager, display: normalizeHouseInput(target).ok ? (normalizeHouseInput(target) as { value: string }).value : target };
}

/** Saves where a house is. */
export async function PUT(req: NextRequest) {
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidLatLng(parsed.data.lat, parsed.data.lng)) {
    return invalidInput('That location does not look right. Please try again.');
  }

  const r = await resolveHouse(req, parsed.data.neighborhoodId, parsed.data.house);
  if (r.error) return r.error;
  const { guard, key, isManager, display } = r;

  const saved = await prisma.houseLocation.upsert({
    where: { neighborhoodId_houseKey: { neighborhoodId: guard.neighborhoodId, houseKey: key } },
    create: {
      neighborhoodId: guard.neighborhoodId,
      houseKey: key,
      house: display,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      setById: guard.auth.userId,
      setByRole: isManager ? 'committee' : 'member',
    },
    update: {
      house: display,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      setById: guard.auth.userId,
      setByRole: isManager ? 'committee' : 'member',
    },
  });
  return ok({ house: saved.house, lat: Number(saved.lat), lng: Number(saved.lng) });
}

/** Removes a house's saved location. */
export async function DELETE(req: NextRequest) {
  const neighborhoodId = req.nextUrl.searchParams.get('neighborhoodId') ?? undefined;
  const house = req.nextUrl.searchParams.get('house') ?? undefined;

  const r = await resolveHouse(req, neighborhoodId, house);
  if (r.error) return r.error;

  await prisma.houseLocation.deleteMany({ where: { neighborhoodId: r.guard.neighborhoodId, houseKey: r.key } });
  return ok({ removed: true });
}
