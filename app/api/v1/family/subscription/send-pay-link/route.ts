import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { sendFamilyPayLink } from '@/lib/family-pay-link';

const schema = z.object({ auto: z.boolean().optional() });

const MIN = 60_000;
const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Sends the signed-in family member a private "how to pay" link by email (and
 *  WhatsApp once set up). The Android app calls this from its plan screen
 *  instead of showing a price or a pay button, which Google Play does not allow.
 *  `auto` is the app opening the screen by itself (at most one message a day);
 *  without it the person tapped "Send it again" (at most one every 10 minutes). */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'caregiver') return fail('FORBIDDEN', 'Family members only.', 403);

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const auto = parsed.success && parsed.data.auto === true;

  const result = await sendFamilyPayLink(auth.userId, auto ? 24 * 60 * MIN : 10 * MIN);
  if (result.ok) return NextResponse.json({ success: true, data: { sent: true, channels: result.channels } });

  switch (result.reason) {
    case 'throttled':
      return NextResponse.json({ success: true, data: { sent: false, alreadySent: true } });
    case 'not_found':
      return fail('NOT_FOUND', 'No family plan found for your account.', 404);
    default:
      return fail('SEND_FAILED', "We couldn't send the details just now. Please try again later, or write to care@eccare.in.", 502);
  }
}
