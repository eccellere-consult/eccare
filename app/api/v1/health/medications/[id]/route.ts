import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';
import { ensureRemindersForMedication } from '@/lib/medicine-reminders';
import { cleanTimeSlots, findDuplicateMedicineIds } from '@/lib/medicine-guards';

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
  const med = await prisma.medication.findUnique({
    where: { id },
    select: { userId: true, name: true, dosage: true, timeSlots: true },
  });
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

  let cleanedSlots: string[] | undefined;
  if (parsed.data.timeSlots) {
    const times = cleanTimeSlots(parsed.data.timeSlots);
    if (!times.ok) return fail('VALIDATION', times.message);
    cleanedSlots = times.slots;
  }

  const { endDate, ...rest } = parsed.data;

  // Changing what a medicine is (name, strength, times) or switching it back on must not turn it
  // into a copy of another active medicine: that would ring the same dose twice.
  const changesIdentity =
    parsed.data.name !== undefined ||
    parsed.data.dosage !== undefined ||
    cleanedSlots !== undefined ||
    parsed.data.isActive === true;
  if (changesIdentity) {
    const after = {
      id,
      name: parsed.data.name ?? med.name,
      dosage: parsed.data.dosage ?? med.dosage,
      timeSlots: cleanedSlots ?? (med.timeSlots as string[]),
      // "Newer than everything else", so if it clashes it is THIS one that counts as the copy.
      createdAt: new Date(),
    };
    const others = await prisma.medication.findMany({
      where: { userId: med.userId, isActive: true, id: { not: id } },
      select: { id: true, name: true, dosage: true, timeSlots: true, createdAt: true },
    });
    const clash = findDuplicateMedicineIds([
      after,
      ...others.map((o) => ({ ...o, timeSlots: o.timeSlots as string[] })),
    ]).includes(id);
    if (clash) {
      return fail(
        'DUPLICATE_MEDICATION',
        `${after.name} ${after.dosage} at these times is already on the medicine list. Saving this would double the doses.`,
        409,
      );
    }
  }

  const updated = await prisma.medication.update({
    where: { id },
    data: {
      ...rest,
      ...(cleanedSlots ? { timeSlots: cleanedSlots } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? localTimeToUtcDate(endDate, '00:00') : null } : {}),
    },
  });

  // New times: today's and later reminders that were made for the OLD times must go, or the
  // elder would see both the old and the new dose. Past ones stay as history. The new ones
  // are made straight away (and by the self-heal on the next page open).
  if (cleanedSlots) {
    await prisma.medicationReminder.deleteMany({
      where: { medicationId: id, status: 'pending', scheduledAt: { gte: localTimeToUtcDate(todayIST(), '00:00') } },
    });
    if (updated.isActive) await ensureRemindersForMedication(updated, todayIST());
  }

  // Pausing a medication only stops *future* reminder generation
  // (ensureRemindersForMedication skips inactive medications) — it doesn't touch
  // reminders already created for today (or any date) before the pause. Without
  // this, GET /reminders (which reads MedicationReminder rows directly, with no
  // regard for the parent medication's isActive flag) keeps showing an already-
  // generated "pending" reminder on the elder's page even though the caregiver's
  // own list correctly hides the now-inactive medication — exactly the reported
  // "paused on caregiver side, still showing on elder side" bug. Only pending
  // (not-yet-acted-on) reminders are removed; taken/missed/snoozed history stays.
  if (parsed.data.isActive === false) {
    await prisma.medicationReminder.deleteMany({ where: { medicationId: id, status: 'pending' } });
  }

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
