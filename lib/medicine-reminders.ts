import { prisma } from '@/lib/db';
import { localTimeToUtcDate } from '@/lib/medicine-slots';

interface MedicationForReminders {
  id: string;
  userId: string;
  isActive: boolean;
  timeSlots: unknown;
  endDate: Date | null;
}

/**
 * Idempotently ensures MedicationReminder rows exist for one medication on one date.
 * Skips entirely if the medication is inactive, or the date is past its
 * doctor-recommended endDate (see the schema comment on Medication.endDate — the
 * record itself is never touched, only new reminder generation stops).
 *
 * This is the single source of truth for reminder generation — both the on-demand
 * POST /reminders/generate route and the auto-heal call from GET /reminders go
 * through this, so there's exactly one place that decides whether a reminder should
 * exist for a given (medication, date) pair.
 */
export async function ensureRemindersForMedication(
  medication: MedicationForReminders,
  date: string,
): Promise<number> {
  if (!medication.isActive) return 0;

  if (medication.endDate) {
    const dateAsIstMidnightUtc = localTimeToUtcDate(date, '00:00');
    if (dateAsIstMidnightUtc > medication.endDate) return 0;
  }

  const slots = medication.timeSlots as string[];
  let createdCount = 0;

  for (const slot of slots) {
    const scheduledAt = localTimeToUtcDate(date, slot);

    const existing = await prisma.medicationReminder.findFirst({
      where: { medicationId: medication.id, scheduledAt },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.medicationReminder.create({
      data: { medicationId: medication.id, userId: medication.userId, scheduledAt },
    });
    createdCount++;
  }

  return createdCount;
}

/** Ensures reminders exist for every active medication a user has, for one date.
 *  This is what makes the pill box self-healing — call it before reading reminders
 *  for any date and it never depends on a cron job or a manual "generate" trigger. */
export async function ensureRemindersForUser(userId: string, date: string): Promise<number> {
  const medications = await prisma.medication.findMany({
    where: { userId, isActive: true },
    select: { id: true, userId: true, isActive: true, timeSlots: true, endDate: true },
  });

  let total = 0;
  for (const med of medications) {
    total += await ensureRemindersForMedication(med, date);
  }
  return total;
}
