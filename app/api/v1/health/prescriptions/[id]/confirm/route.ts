import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Medication } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';
import { ensureRemindersForMedication } from '@/lib/medicine-reminders';
import { withPersonMedicineLock } from '@/lib/medicine-lock';
import {
  MAX_MEDICINES_PER_PRESCRIPTION,
  cleanTimeSlots,
  collapseDuplicateMedicines,
  splitAgainstExisting,
} from '@/lib/medicine-guards';

const medicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().min(1).max(100),
  timeSlots: z.array(z.string()).min(1).max(20),
  instructions: z.string().max(1000).nullable().optional(),
  // A short antibiotic-style course, e.g. 5 — null/omitted means indefinite/ongoing
  // (the common case for elder medication). Converted to a concrete endDate here.
  durationDays: z.number().int().positive().max(3650).nullable().optional(),
});

const appointmentSchema = z.object({
  doctorName: z.string().min(1).max(200),
  hospital: z.string().max(200).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  datetime: z.string(),
  notes: z.string().max(1000).nullable().optional(),
});

const confirmSchema = z.object({
  medications: z.array(medicationSchema).max(MAX_MEDICINES_PER_PRESCRIPTION),
  appointment: appointmentSchema.nullable().optional(),
});

type Outcome =
  | { kind: 'already_reviewed' }
  | {
      kind: 'saved';
      created: Medication[];
      skipped: { name: string; dosage: string }[];
      warnings: string[];
      appointment: unknown;
    };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: { userId: true, reviewed: true, doctorName: true },
  });
  if (!prescription) return fail('NOT_FOUND', 'Prescription not found.', 404);

  const guard = await requireHealthAccess(req, prescription.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You need medication management permission.', 403);
  }
  if (prescription.reviewed) {
    return fail('ALREADY_REVIEWED', 'This prescription has already been added to the calendar.');
  }

  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  // Check every medicine's times BEFORE anything is saved: one bad time must not leave half a
  // prescription in the calendar.
  const cleaned = [];
  for (const med of parsed.data.medications) {
    const times = cleanTimeSlots(med.timeSlots);
    if (!times.ok) return fail('VALIDATION', `${med.name}: ${times.message}`);
    cleaned.push({ ...med, timeSlots: times.slots });
  }

  // The same medicine typed twice on one prescription becomes one.
  const { kept: toSave, dropped } = collapseDuplicateMedicines(cleaned);

  let appointmentDate: Date | null = null;
  if (parsed.data.appointment) {
    appointmentDate = new Date(parsed.data.appointment.datetime);
    if (isNaN(appointmentDate.getTime())) return fail('VALIDATION', 'Appointment date/time is invalid.');
  }

  const today = todayIST();

  // Everything below happens under the person's lock and in ONE database transaction:
  //  1. the prescription is claimed ("reviewed") atomically, so a double tap or two devices pressing
  //     Save together can only ever save it once;
  //  2. medicines already on the list (same name and strength) are skipped, never doubled;
  //  3. if anything fails, nothing at all is saved and the prescription stays open to retry.
  const outcome = await withPersonMedicineLock<Outcome | null>(
    guard.elderUserId,
    async (tx) => {
      const claimed = await tx.prescription.updateMany({ where: { id, reviewed: false }, data: { reviewed: true } });
      if (claimed.count !== 1) return { kind: 'already_reviewed' };

      const current = await tx.medication.findMany({
        where: { userId: guard.elderUserId, isActive: true },
        select: { name: true, dosage: true, endDate: true },
      });
      const ongoing = current.filter((m) => !m.endDate || m.endDate >= new Date());
      const { fresh, duplicates, warnings } = splitAgainstExisting(toSave, ongoing);

      const created: Medication[] = [];
      for (const med of fresh) {
        let endDate: Date | null = null;
        if (med.durationDays) {
          const endDateStr = new Date(Date.now() + med.durationDays * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          endDate = localTimeToUtcDate(endDateStr, '00:00');
        }
        created.push(
          await tx.medication.create({
            data: {
              userId: guard.elderUserId,
              prescriptionId: id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              timeSlots: med.timeSlots,
              instructions: med.instructions ?? null,
              prescribingDoctor: prescription.doctorName,
              endDate,
            },
          }),
        );
      }

      let appointment: unknown = null;
      if (parsed.data.appointment && appointmentDate) {
        // The same visit (same doctor, same time) is never booked twice.
        const already = await tx.appointment.findFirst({
          where: { userId: guard.elderUserId, doctorName: parsed.data.appointment.doctorName, datetime: appointmentDate },
        });
        appointment =
          already ??
          (await tx.appointment.create({
            data: {
              userId: guard.elderUserId,
              doctorName: parsed.data.appointment.doctorName,
              hospital: parsed.data.appointment.hospital ?? null,
              specialty: parsed.data.appointment.specialty ?? null,
              datetime: appointmentDate,
              notes: parsed.data.appointment.notes ?? null,
            },
          }));
      }

      return {
        kind: 'saved',
        created,
        skipped: [...duplicates, ...dropped].map((m) => ({ name: m.name, dosage: m.dosage })),
        warnings,
        appointment,
      };
    },
    null,
  );

  if (!outcome) return fail('BUSY', 'Another change is being saved for this person. Please try again in a moment.', 409);
  if (outcome.kind === 'already_reviewed') {
    return fail('ALREADY_REVIEWED', 'This prescription has already been added to the calendar.');
  }

  // Reminders are made after the save is final (they point at the new medicines).
  for (const medication of outcome.created) {
    await ensureRemindersForMedication(medication, today);
  }

  return ok(
    {
      createdMedications: outcome.created.length,
      medications: outcome.created,
      skippedDuplicates: outcome.skipped,
      warnings: outcome.warnings,
      appointment: outcome.appointment,
    },
    201,
  );
}
