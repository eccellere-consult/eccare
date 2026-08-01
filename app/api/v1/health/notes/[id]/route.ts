import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const note = await prisma.healthNote.findUnique({
    where: { id },
    select: { userId: true, createdById: true },
  });
  if (!note) return fail('NOT_FOUND', 'Note not found.', 404);

  const guard = await requireHealthAccess(req, note.userId);
  if (guard instanceof Response) return guard;

  if (guard.userId !== note.createdById && guard.role !== 'admin') {
    return fail('FORBIDDEN', 'You can only delete notes you created.', 403);
  }

  await prisma.healthNote.delete({ where: { id } });
  return ok({ deleted: true });
}
