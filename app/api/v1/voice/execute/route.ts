import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isConfirmRequiredAction, executeVoiceAction } from '@/lib/voice-actions';

const schema = z.object({
  action: z.string(),
  actionData: z.record(z.string(), z.unknown()).optional(),
});

/** Runs a voice action the elder has explicitly confirmed via the Confirm/Cancel
 *  step in the UI — see components/voice-assistant.tsx. Only the four
 *  CONFIRM_REQUIRED_ACTIONS (lib/claude.ts) are valid here; trigger_sos and
 *  call_contact stay entirely client-side/immediate and never call this route. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Nothing to confirm.' } },
      { status: 400 },
    );
  }

  const { action, actionData } = parsed.data;
  if (!isConfirmRequiredAction(action)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: "That isn't something I can confirm and run." } },
      { status: 400 },
    );
  }

  const result = await executeVoiceAction(action, actionData, auth.userId);

  // The original request/response already has its own VoiceLog row from
  // POST /voice/process — this second row captures whether the confirmed action
  // actually succeeded once run, which the first row can't know yet at that point.
  await prisma.voiceLog.create({
    data: {
      userId: auth.userId,
      transcript: `[confirmed] ${action}`,
      intent: action,
      responseText: result.message,
      actionTaken: result.success ? action : `${action}_failed`,
    },
  });

  return NextResponse.json({ success: true, data: result });
}
