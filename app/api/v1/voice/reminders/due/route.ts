import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Polled client-side by ReminderAlerts (mounted in the elder app shell) while the
 *  app is open — the in-app stand-in for real push delivery. lib/fcm.ts is real
 *  (Firebase Admin SDK), but the only code that ever registers a device token
 *  (POST /api/v1/notifications/register-device) is called by the separate mobile
 *  app, not this web app — so a scheduled push job would silently reach zero web
 *  users today. This route is the practical alternative: while the elder's app is
 *  open, it surfaces any of their own voice-created Reminders whose remindAt has
 *  passed and haven't been shown yet, then immediately marks them notified so the
 *  same one never surfaces twice. Real Web Push (works even with the app closed)
 *  is a distinct, larger follow-up — see the PR description. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const due = await prisma.reminder.findMany({
    where: { userId: auth.userId, notified: false, remindAt: { lte: new Date() } },
    orderBy: { remindAt: 'asc' },
  });

  if (due.length > 0) {
    await prisma.reminder.updateMany({
      where: { id: { in: due.map((r) => r.id) } },
      data: { notified: true },
    });
  }

  return NextResponse.json({ success: true, data: due });
}
