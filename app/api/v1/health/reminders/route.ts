import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok } from '@/lib/health-access';

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

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
