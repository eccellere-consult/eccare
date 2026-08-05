import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

/** Dismisses a reminder once it's been seen/acted on — deleted outright rather than
 *  soft-marked, matching how throwaway this concept is (see the Reminder model
 *  comment: it's an informal one-off, not a record worth keeping history of). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reminder = await prisma.reminder.findUnique({ where: { id } });
  if (!reminder) return fail('NOT_FOUND', 'Reminder not found.', 404);

  const guard = await requireHealthAccess(req, reminder.userId);
  if (guard instanceof Response) return guard;

  await prisma.reminder.delete({ where: { id } });
  return ok({ deleted: true });
}
