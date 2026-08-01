import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const updateSchema = z.object({
  status: z.enum(['taken', 'missed', 'snoozed']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reminder = await prisma.medicationReminder.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!reminder) return fail('NOT_FOUND', 'Reminder not found.', 404);

  const guard = await requireHealthAccess(req, reminder.userId);
  if (guard instanceof Response) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const updated = await prisma.medicationReminder.update({
    where: { id },
    data: {
      status: parsed.data.status,
      takenAt: parsed.data.status === 'taken' ? new Date() : null,
    },
  });

  return ok(updated);
}
