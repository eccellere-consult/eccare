import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { processVoiceInput } from '@/lib/claude';
import { todayIST } from '@/lib/medicine-slots';
import { z } from 'zod';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** e.g. "Monday, 2026-08-10" — lets Claude resolve "tomorrow"/"Friday" into an
 *  absolute ISO datetime itself instead of the app trying to parse free-form
 *  natural-language dates back out of its response. new Date("YYYY-MM-DD") parses
 *  as UTC midnight, which is safe here since only the weekday name is derived from
 *  it (todayIST() already accounts for the IST offset for the date itself). */
function todayContextLine(): string {
  const iso = todayIST();
  const weekday = WEEKDAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `Today: ${weekday}, ${iso} (IST)`;
}

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
        todayContextLine(),
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
