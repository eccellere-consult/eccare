import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Un-pins a Local Directory entry — see POST /community/directory/favorites for
 *  what entryKey means. Deleting a row that doesn't exist (already unfavorited,
 *  or never was) is a no-op, not an error — toggling is idempotent either way. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entryKey: string }> }) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const { entryKey } = await params;
  await prisma.neighborFavorite
    .delete({ where: { userId_entryKey: { userId: guard.auth.userId, entryKey: decodeURIComponent(entryKey) } } })
    .catch(() => {});

  return ok({ favorited: false });
}
