import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { ensureRemindersForMedication } from '@/lib/medicine-reminders';

const generateSchema = z.object({
  medicationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Manual/explicit trigger — kept for cases like generating a future date ahead of
 *  time. GET /reminders auto-heals today's reminders on every read via the same
 *  helper, so this route is no longer the only way reminders get created. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const med = await prisma.medication.findUnique({
    where: { id: parsed.data.medicationId },
    select: { id: true, userId: true, isActive: true, timeSlots: true, endDate: true },
  });
  if (!med) return fail('NOT_FOUND', 'Medication not found.', 404);
  if (!med.isActive) return fail('INACTIVE', 'Cannot generate reminders for an inactive medication.');

  const guard = await requireHealthAccess(req, med.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission.', 403);
  }

  const generated = await ensureRemindersForMedication(med, parsed.data.date);

  return ok({ generated }, 201);
}
