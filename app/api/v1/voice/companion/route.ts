import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { generateCompanionGreeting } from '@/lib/claude';
import { getSlotForDate, localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';

type Suggestion =
  | { type: 'appointment'; message: string }
  | { type: 'call'; message: string; phone: string };

const MOOD_LABEL: Record<string, string> = {
  great: 'great',
  good: 'good',
  okay: 'okay',
  low: 'a bit low',
  not_well: 'not well',
};

/** The AI Companion's "speaks first" home-page greeting — see components/companion-card.tsx.
 *  Elder-only: this is inherently a first-person "how are you" surface, not something
 *  a caregiver or admin views on someone else's behalf. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      elderRelations: { where: { inviteStatus: 'accepted' }, include: { caregiverUser: { select: { name: true, phone: true } } } },
      appointments: {
        where: { status: 'upcoming', datetime: { gte: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) } },
        orderBy: { datetime: 'asc' },
        take: 1,
      },
    },
  });
  if (!user || user.role !== 'elder') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'This is only available for elder accounts.' } }, { status: 403 });
  }

  const todayStart = localTimeToUtcDate(todayIST(), '00:00');
  const todaysMood = await prisma.moodLog.findFirst({
    where: { userId: auth.userId, createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });

  const timeOfDay = getSlotForDate(new Date());

  const suggestions: Suggestion[] = [];

  const nextAppt = user.appointments[0];
  let apptNote: string | undefined;
  if (nextAppt) {
    const when = nextAppt.datetime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const isToday = nextAppt.datetime.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayIST();
    const dayWord = isToday ? 'today' : 'soon';
    const message = `You have an appointment with ${nextAppt.doctorName} ${isToday ? 'today' : 'coming up'} — ${when}.`;
    suggestions.push({ type: 'appointment', message });
    apptNote = `They have an appointment with ${nextAppt.doctorName} ${dayWord}.`;
  }

  const callable = user.elderRelations.find((r) => r.caregiverUser.phone);
  if (callable) {
    suggestions.push({
      type: 'call',
      message: `Would you like to call your ${callable.relationship.toLowerCase()}?`,
      phone: callable.caregiverUser.phone as string,
    });
  }

  const greeting = await generateCompanionGreeting({ name: user.name, timeOfDay, note: apptNote });

  return NextResponse.json({
    success: true,
    data: {
      greeting,
      moodLoggedToday: Boolean(todaysMood),
      todaysMood: todaysMood ? MOOD_LABEL[todaysMood.mood] ?? todaysMood.mood : null,
      suggestions: suggestions.slice(0, 2),
    },
  });
}
