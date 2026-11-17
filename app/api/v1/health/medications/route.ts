import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Medication } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { ensureRemindersForMedication } from '@/lib/medicine-reminders';
import { withPersonMedicineLock } from '@/lib/medicine-lock';
import { cleanTimeSlots, splitAgainstExisting } from '@/lib/medicine-guards';
import { todayIST } from '@/lib/medicine-slots';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().min(1).max(100),
  timeSlots: z.array(z.string()).min(1).max(20),
  instructions: z.string().max(1000).optional(),
  prescribingDoctor: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const showInactive = req.nextUrl.searchParams.get('all') === '1';

  const medications = await prisma.medication.findMany({
    where: { userId: guard.elderUserId, ...(showInactive ? {} : { isActive: true }) },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return ok(medications);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission for this elder.', 403);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { elderUserId: _, ...data } = parsed.data;

  const times = cleanTimeSlots(data.timeSlots);
  if (!times.ok) return fail('VALIDATION', times.message);

  // The duplicate check and the save happen under the person's lock, so a double tap on "Add"
  // (or the same request arriving twice) can never save the same medicine twice.
  type Outcome =
    | { kind: 'duplicate' }
    | { kind: 'created'; medication: Medication; warnings: string[] };
  const outcome = await withPersonMedicineLock<Outcome | null>(
    guard.elderUserId,
    async (tx) => {
      const current = await tx.medication.findMany({
        where: { userId: guard.elderUserId, isActive: true },
        select: { name: true, dosage: true, endDate: true },
      });
      const ongoing = current.filter((m) => !m.endDate || m.endDate >= new Date());
      const { duplicates, warnings } = splitAgainstExisting([{ name: data.name, dosage: data.dosage }], ongoing);
      if (duplicates.length > 0) return { kind: 'duplicate' };
      const medication = await tx.medication.create({
        data: { ...data, name: data.name.trim(), dosage: data.dosage.trim(), timeSlots: times.slots, userId: guard.elderUserId },
      });
      return { kind: 'created', medication, warnings };
    },
    null,
  );

  if (!outcome) return fail('BUSY', 'Another change is being saved for this person. Please try again in a moment.', 409);
  if (outcome.kind === 'duplicate') {
    return fail(
      'DUPLICATE_MEDICATION',
      `${data.name} ${data.dosage} is already on the medicine list. Adding it again would double the doses. If this is a different strength or time, change it and try again.`,
      409,
    );
  }

  // Immediate feedback — today's pill box shows this medicine right away rather than
  // waiting for the next GET /reminders auto-heal (which would also cover it).
  await ensureRemindersForMedication(outcome.medication, todayIST());

  return ok({ ...outcome.medication, warnings: outcome.warnings }, 201);
}
