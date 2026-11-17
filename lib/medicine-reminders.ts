import type { Prisma } from '@prisma/client';
import { localTimeToUtcDate } from '@/lib/medicine-slots';
import { withPersonMedicineLock } from '@/lib/medicine-lock';
import { findDuplicateMedicineIds, findDuplicateReminderIds } from '@/lib/medicine-guards';

interface MedicationForReminders {
  id: string;
  userId: string;
  isActive: boolean;
  timeSlots: unknown;
  endDate: Date | null;
}

/** Makes the missing reminder rows for one medicine on one date. Callers hold the person's lock. */
async function createMissingReminders(
  tx: Prisma.TransactionClient,
  medication: MedicationForReminders,
  date: string,
): Promise<number> {
  if (!medication.isActive) return 0;

  if (medication.endDate) {
    const dateAsIstMidnightUtc = localTimeToUtcDate(date, '00:00');
    if (dateAsIstMidnightUtc > medication.endDate) return 0;
  }

  const slots = [...new Set(medication.timeSlots as string[])];
  const wanted = slots.map((slot) => localTimeToUtcDate(date, slot));
  if (wanted.length === 0) return 0;

  const existing = await tx.medicationReminder.findMany({
    where: { medicationId: medication.id, scheduledAt: { in: wanted } },
    select: { scheduledAt: true },
  });
  const have = new Set(existing.map((r) => r.scheduledAt.getTime()));
  const missing = wanted.filter((at) => !have.has(at.getTime()));
  if (missing.length === 0) return 0;

  await tx.medicationReminder.createMany({
    data: missing.map((scheduledAt) => ({ medicationId: medication.id, userId: medication.userId, scheduledAt })),
  });
  return missing.length;
}

/** Removes extra copies of the same dose (same medicine, same minute) for one day. */
async function removeDuplicateReminders(tx: Prisma.TransactionClient, userId: string, date: string): Promise<number> {
  const startOfDay = localTimeToUtcDate(date, '00:00');
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  const rows = await tx.medicationReminder.findMany({
    where: { userId, scheduledAt: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, medicationId: true, scheduledAt: true, status: true, createdAt: true },
  });
  const extra = findDuplicateReminderIds(rows);
  if (extra.length === 0) return 0;
  console.warn(`[medicine-reminders] removed ${extra.length} duplicate reminder(s) for user ${userId} on ${date}`);
  await tx.medicationReminder.deleteMany({ where: { id: { in: extra } } });
  return extra.length;
}

/**
 * Idempotently ensures MedicationReminder rows exist for one medication on one date.
 * Skips entirely if the medication is inactive, or the date is past its
 * doctor-recommended endDate (see the schema comment on Medication.endDate — the
 * record itself is never touched, only new reminder generation stops).
 *
 * Safe to call from several requests at once: it runs under the person's medicine lock
 * (lib/medicine-lock.ts), so two callers can never both decide "missing" and both create.
 */
export async function ensureRemindersForMedication(
  medication: MedicationForReminders,
  date: string,
): Promise<number> {
  return withPersonMedicineLock(
    medication.userId,
    async (tx) => {
      const created = await createMissingReminders(tx, medication, date);
      await removeDuplicateReminders(tx, medication.userId, date);
      return created;
    },
    0,
  );
}

/** Ensures reminders exist for every active medication a user has, for one date.
 *  This is what makes the pill box self-healing — call it before reading reminders
 *  for any date and it never depends on a cron job or a manual "generate" trigger.
 *
 *  It also repairs data that was damaged before these guards existed:
 *  - an active medicine that is an exact copy (name, strength, times) of an older one is paused,
 *    because it would ring the same dose twice (the family can resume it from the medicine list);
 *  - extra copies of the same dose on this date are removed. */
export async function ensureRemindersForUser(userId: string, date: string): Promise<number> {
  return withPersonMedicineLock(
    userId,
    async (tx) => {
      const medications = await tx.medication.findMany({
        where: { userId, isActive: true },
        select: { id: true, userId: true, isActive: true, timeSlots: true, endDate: true, name: true, dosage: true, createdAt: true },
      });

      const duplicateIds = new Set(
        findDuplicateMedicineIds(
          medications.map((m) => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage,
            timeSlots: m.timeSlots as string[],
            createdAt: m.createdAt,
          })),
        ),
      );
      if (duplicateIds.size > 0) {
        console.warn(`[medicine-reminders] pausing ${duplicateIds.size} duplicate medicine(s) for user ${userId}`);
        await tx.medicationReminder.deleteMany({ where: { medicationId: { in: [...duplicateIds] }, status: 'pending' } });
        await tx.medication.updateMany({ where: { id: { in: [...duplicateIds] } }, data: { isActive: false } });
      }

      let total = 0;
      for (const med of medications) {
        if (duplicateIds.has(med.id)) continue;
        total += await createMissingReminders(tx, med, date);
      }
      await removeDuplicateReminders(tx, userId, date);
      return total;
    },
    0,
  );
}
