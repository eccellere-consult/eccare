import { prisma } from '@/lib/db';
import { sendPushToTokens } from '@/lib/fcm';
import { type ConfirmRequiredAction } from '@/lib/voice-shared';

export { isConfirmRequiredAction } from '@/lib/voice-shared';

interface ExecuteResult {
  success: boolean;
  /** Spoken back to the elder — confirms what happened, or plainly explains why not. */
  message: string;
}

function str(data: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = data?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

// Requires an actual ISO 8601 date+time — "2026-08-15T16:00:00+05:30" or
// "...Z" — not just anything Date can loosely parse. That distinction matters:
// `new Date("tomorrow at 4")` does NOT throw or produce an Invalid Date the way a
// naive `Number.isNaN(date.getTime())` check would assume — it silently parses to
// some unrelated date (confirmed during this feature's own testing: it landed on
// April 1st, midnight). The system prompt tells Claude to always resolve relative
// dates into ISO itself, so this regex is the enforcement of that contract, not
// just a parse-failure catch — a raw unresolved phrase must be rejected outright,
// never silently misinterpreted into a real appointment/reminder on the wrong day.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function parseDateTime(data: Record<string, unknown> | undefined, key: string): Date | null {
  const raw = str(data, key);
  if (!raw || !ISO_DATETIME_RE.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Every caregiver linked to this elder with an accepted invite — the pool
 *  send_family_message matches against. */
async function getLinkedCaregivers(elderUserId: string) {
  return prisma.familyRelation.findMany({
    where: { elderUserId, inviteStatus: 'accepted' },
    include: { caregiverUser: { include: { deviceTokens: true } } },
  });
}

async function sendFamilyMessage(elderUserId: string, data: Record<string, unknown> | undefined): Promise<ExecuteResult> {
  const message = str(data, 'message');
  if (!message) return { success: false, message: "I didn't catch what you wanted to say." };

  const relationship = str(data, 'relationship')?.toLowerCase();
  const contactName = str(data, 'contactName')?.toLowerCase();
  const caregivers = await getLinkedCaregivers(elderUserId);

  // A specific person was named — only message them, and say so plainly if they
  // can't be found rather than silently messaging someone else instead.
  let targets = caregivers;
  if (relationship || contactName) {
    targets = caregivers.filter(
      (r) =>
        (relationship && r.relationship.toLowerCase().includes(relationship)) ||
        (contactName && r.caregiverUser.name.toLowerCase().includes(contactName)),
    );
    if (targets.length === 0) {
      const who = relationship || contactName;
      return { success: false, message: `I couldn't find ${who} in your family list.` };
    }
  }
  if (targets.length === 0) {
    return { success: false, message: "You don't have any family connected yet to message." };
  }

  const elder = await prisma.user.findUnique({ where: { id: elderUserId }, select: { name: true } });
  const tokens = targets.flatMap((r) => r.caregiverUser.deviceTokens.map((dt) => dt.token));
  await sendPushToTokens(tokens, {
    title: `Message from ${elder?.name ?? 'your family member'}`,
    body: message,
    data: { type: 'voice_message' },
  });

  const names = targets.map((r) => r.caregiverUser.name).join(' and ');
  return { success: true, message: `Done — I've let ${names} know.` };
}

async function bookAppointment(userId: string, data: Record<string, unknown> | undefined): Promise<ExecuteResult> {
  const doctorName = str(data, 'doctorName');
  const datetime = parseDateTime(data, 'datetime');
  if (!doctorName || !datetime) {
    return { success: false, message: "I need a doctor's name and a time to book that — could you say it again?" };
  }

  await prisma.appointment.create({
    data: {
      userId,
      doctorName,
      hospital: str(data, 'hospital'),
      specialty: str(data, 'specialty'),
      notes: str(data, 'notes'),
      datetime,
      status: 'upcoming',
    },
  });

  const when = datetime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return { success: true, message: `Booked — ${doctorName} on ${when}.` };
}

const FOOD_REQUEST_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;

async function orderFood(userId: string, data: Record<string, unknown> | undefined): Promise<ExecuteResult> {
  const requestType = str(data, 'requestType');
  if (!requestType || !(FOOD_REQUEST_TYPES as readonly string[]).includes(requestType)) {
    return { success: false, message: 'Which meal would you like help with?' };
  }

  const foodReq = await prisma.foodRequest.create({
    data: { userId, requestType, notes: str(data, 'notes') },
  });

  // Same notify-family-caregivers behavior as the existing Meal Help buttons on the
  // elder health page (POST /api/v1/health/food-requests) — this is the same
  // underlying action, just reached by voice instead of a tap.
  const elder = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const caregivers = await getLinkedCaregivers(userId);
  const tokens = caregivers.flatMap((r) => r.caregiverUser.deviceTokens.map((dt) => dt.token));
  if (tokens.length > 0) {
    await sendPushToTokens(tokens, {
      title: 'Meal request',
      body: `${elder?.name ?? 'Your elder'} needs help with ${requestType}.`,
      data: { type: 'food_request', requestId: foodReq.id },
    });
  }

  return { success: true, message: `Done — I've asked your family to help with ${requestType}.` };
}

async function setReminder(userId: string, data: Record<string, unknown> | undefined): Promise<ExecuteResult> {
  const message = str(data, 'message');
  const remindAt = parseDateTime(data, 'remindAt');
  if (!message || !remindAt) {
    return { success: false, message: "I need to know what to remind you about and when — could you say it again?" };
  }

  await prisma.reminder.create({ data: { userId, message, remindAt } });

  const when = remindAt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return { success: true, message: `Done — I'll remind you: ${message}, on ${when}.` };
}

/** Runs one of CONFIRM_REQUIRED_ACTIONS for real, after the elder has explicitly
 *  confirmed it in the UI. Never called for the auto-execute actions (trigger_sos,
 *  call_contact, show_medicines, show_appointments, check_status) — those stay
 *  entirely client-side/immediate, same as before this feature. */
export async function executeVoiceAction(
  action: ConfirmRequiredAction,
  actionData: Record<string, unknown> | undefined,
  userId: string,
): Promise<ExecuteResult> {
  switch (action) {
    case 'send_family_message':
      return sendFamilyMessage(userId, actionData);
    case 'book_appointment':
      return bookAppointment(userId, actionData);
    case 'order_food':
      return orderFood(userId, actionData);
    case 'set_reminder':
      return setReminder(userId, actionData);
  }
}
