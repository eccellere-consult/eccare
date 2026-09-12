import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, ok, invalidInput } from '@/lib/community-route';

const schema = z.object({ entryKey: z.string().min(1).max(200) });

/** Pins a Local Directory entry (see GET /community/directory) to the top of the
 *  current user's own view — personal, never visible to anyone else. entryKey is
 *  that route's own composite id ("member:<userId>" or "contact:<contactId>"), not
 *  a real FK, since a favorite can point at either kind of entry. */
export async function POST(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  await prisma.neighborFavorite.upsert({
    where: { userId_entryKey: { userId: guard.auth.userId, entryKey: parsed.data.entryKey } },
    create: { userId: guard.auth.userId, neighborhoodId: guard.neighborhoodId, entryKey: parsed.data.entryKey },
    update: {},
  });

  return ok({ favorited: true });
}
