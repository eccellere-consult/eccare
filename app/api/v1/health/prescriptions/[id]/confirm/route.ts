import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  timeSlots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  instructions: z.string().max(1000).nullable().optional(),
});

const appointmentSchema = z.object({
  doctorName: z.string().min(1).max(200),
  hospital: z.string().max(200).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  datetime: z.string(),
  notes: z.string().max(1000).nullable().optional(),
});

const confirmSchema = z.object({
  medications: z.array(medicationSchema),
  appointment: appointmentSchema.nullable().optional(),
});

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

  const createdMeds = [];
  for (const med of parsed.data.medications) {
    const medication = await prisma.medication.create({
      data: {
        userId: guard.elderUserId,
        prescriptionId: id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        timeSlots: med.timeSlots,
        instructions: med.instructions ?? null,
        prescribingDoctor: prescription.doctorName,
      },
    });
    createdMeds.push(medication);
  }

  const today = todayIST();
  for (const med of createdMeds) {
    const slots = med.timeSlots as string[];
    for (const slot of slots) {
      const scheduledAt = localTimeToUtcDate(today, slot);
      const existing = await prisma.medicationReminder.findFirst({
        where: { medicationId: med.id, scheduledAt },
      });
      if (!existing) {
        await prisma.medicationReminder.create({
          data: {
            medicationId: med.id,
            userId: guard.elderUserId,
            scheduledAt,
          },
        });
      }
    }
  }

  let createdAppointment = null;
  if (parsed.data.appointment) {
    const datetime = new Date(parsed.data.appointment.datetime);
    if (isNaN(datetime.getTime())) {
      return fail('VALIDATION', 'Appointment date/time is invalid.');
    }
    createdAppointment = await prisma.appointment.create({
      data: {
        userId: guard.elderUserId,
        doctorName: parsed.data.appointment.doctorName,
        hospital: parsed.data.appointment.hospital ?? null,
        specialty: parsed.data.appointment.specialty ?? null,
        datetime,
        notes: parsed.data.appointment.notes ?? null,
      },
    });
  }

  await prisma.prescription.update({ where: { id }, data: { reviewed: true } });

  return ok(
    {
      createdMedications: createdMeds.length,
      medications: createdMeds,
      appointment: createdAppointment,
    },
    201,
  );
}
