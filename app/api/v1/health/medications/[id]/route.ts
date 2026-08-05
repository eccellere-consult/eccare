import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { localTimeToUtcDate } from '@/lib/medicine-slots';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dosage: z.string().min(1).max(100).optional(),
  frequency: z.string().min(1).max(100).optional(),
  timeSlots: z.array(z.string()).min(1).optional(),
  instructions: z.string().max(1000).nullable().optional(),
  prescribingDoctor: z.string().max(200).nullable().optional(),
  // "YYYY-MM-DD" or null to clear (go back to indefinite/ongoing).
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const med = await prisma.medication.findUnique({ where: { id }, select: { userId: true } });
  if (!med) return fail('NOT_FOUND', 'Medication not found.', 404);

  const guard = await requireHealthAccess(req, med.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission.', 403);
  }
  if (guard.role === 'elder') {
    return fail('FORBIDDEN', 'Medications are managed by your caregiver.', 403);
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { endDate, ...rest } = parsed.data;
  const updated = await prisma.medication.update({
    where: { id },
    data: {
      ...rest,
      ...(endDate !== undefined ? { endDate: endDate ? localTimeToUtcDate(endDate, '00:00') : null } : {}),
    },
  });
  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const med = await prisma.medication.findUnique({ where: { id }, select: { userId: true } });
  if (!med) return fail('NOT_FOUND', 'Medication not found.', 404);

  const guard = await requireHealthAccess(req, med.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission.', 403);
  }
  if (guard.role === 'elder') {
    return fail('FORBIDDEN', 'Medications are managed by your caregiver.', 403);
  }

  await prisma.medication.delete({ where: { id } });
  return ok({ deleted: true });
}
