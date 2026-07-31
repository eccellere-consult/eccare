import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { processVoiceInput } from '@/lib/claude';
import { z } from 'zod';

const schema = z.object({
  transcript: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'No speech detected.' } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      emergencyContacts: true,
      elderRelations: { include: { caregiverUser: true } },
      medications: { where: { isActive: true } },
      appointments: { where: { status: 'upcoming' }, orderBy: { datetime: 'asc' }, take: 3 },
    },
  });

  const userContext = user
    ? [
        `Name: ${user.name}`,
        `Family contacts: ${user.elderRelations.map((r) => `${r.caregiverUser.name} (${r.relationship})`).join(', ') || 'none'}`,
        `Emergency contacts: ${user.emergencyContacts.map((c) => `${c.name} (${c.relationship})`).join(', ') || 'none'}`,
        `Active medicines: ${user.medications.map((m) => m.name).join(', ') || 'none'}`,
        `Upcoming appointments: ${user.appointments.map((a) => `${a.doctorName} on ${a.datetime}`).join(', ') || 'none'}`,
      ].join('\n')
    : undefined;

  const result = await processVoiceInput(parsed.data.transcript, userContext);

  await prisma.voiceLog.create({
    data: {
      userId: auth.userId,
      transcript: parsed.data.transcript,
      intent: result.intent,
      responseText: result.response,
      actionTaken: result.action,
    },
  });

  return NextResponse.json({ success: true, data: result });
}
