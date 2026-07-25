import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ elderId: string }> },
) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { elderId } = await params;

  const relation = await prisma.familyRelation.findUnique({
    where: {
      elderUserId_caregiverUserId: {
        elderUserId: elderId,
        caregiverUserId: auth.userId,
      },
    },
  });

  if (!relation || relation.inviteStatus !== 'accepted') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access.' } },
      { status: 403 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [elder, recentSos, todayReminders, medications, appointments] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: elderId } }),
      prisma.sOSEvent.findMany({
        where: { userId: elderId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.medicationReminder.findMany({
        where: {
          userId: elderId,
          scheduledAt: { gte: today, lt: tomorrow },
        },
        include: { medication: true },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.medication.findMany({
        where: { userId: elderId, isActive: true },
      }),
      prisma.appointment.findMany({
        where: { userId: elderId, status: 'upcoming' },
        orderBy: { datetime: 'asc' },
        take: 5,
      }),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      elder,
      recentSos,
      todayReminders,
      medications,
      upcomingAppointments: appointments,
    },
  });
}
