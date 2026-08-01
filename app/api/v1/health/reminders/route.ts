import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok } from '@/lib/health-access';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const date = req.nextUrl.searchParams.get('date') || todayIST();
  // Day boundaries in IST, not UTC — a medicine scheduled for 01:00 IST is stored
  // as ~19:30 UTC the previous day, so a naive UTC-midnight range would miss it.
  const startOfDay = localTimeToUtcDate(date, '00:00');
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const reminders = await prisma.medicationReminder.findMany({
    where: {
      userId: guard.elderUserId,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { medication: { select: { name: true, dosage: true, instructions: true } } },
    orderBy: { scheduledAt: 'asc' },
  });

  return ok(reminders);
}
