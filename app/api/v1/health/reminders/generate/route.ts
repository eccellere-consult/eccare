import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const generateSchema = z.object({
  medicationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const med = await prisma.medication.findUnique({
    where: { id: parsed.data.medicationId },
    select: { userId: true, isActive: true, timeSlots: true },
  });
  if (!med) return fail('NOT_FOUND', 'Medication not found.', 404);
  if (!med.isActive) return fail('INACTIVE', 'Cannot generate reminders for an inactive medication.');

  const guard = await requireHealthAccess(req, med.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission.', 403);
  }

  const slots = med.timeSlots as string[];
  const created = [];

  for (const slot of slots) {
    const scheduledAt = new Date(`${parsed.data.date}T${slot}:00.000Z`);

    const existing = await prisma.medicationReminder.findFirst({
      where: { medicationId: parsed.data.medicationId, scheduledAt },
    });
    if (existing) continue;

    const reminder = await prisma.medicationReminder.create({
      data: {
        medicationId: parsed.data.medicationId,
        userId: med.userId,
        scheduledAt,
      },
    });
    created.push(reminder);
  }

  return ok({ generated: created.length, reminders: created }, 201);
}
