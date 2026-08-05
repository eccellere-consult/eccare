import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

/** Informal, voice-created reminders — see prisma/schema.prisma's Reminder model
 *  comment for why this is distinct from the medicine-schedule pill box
 *  (/api/v1/health/reminders, which is MedicationReminder). Same
 *  requireHealthAccess guard as every other health surface, so family with
 *  view access sees these too, not just the elder who spoke them. */
export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const reminders = await prisma.reminder.findMany({
    where: { userId: guard.elderUserId, notified: false },
    orderBy: { remindAt: 'asc' },
    take: 20,
  });

  return ok(reminders);
}
