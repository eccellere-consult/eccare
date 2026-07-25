import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const reminders = await prisma.medicationReminder.findMany({
    where: {
      userId: auth.userId,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { medication: true },
    orderBy: { scheduledAt: 'asc' },
  });

  return NextResponse.json({ success: true, data: reminders });
}
