import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { sendPushToTokens } from '@/lib/fcm';
import { SLOT_META, getSlotForDate } from '@/lib/medicine-slots';

const schema = z.object({
  reminderIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const reminders = await prisma.medicationReminder.findMany({
    where: { id: { in: parsed.data.reminderIds } },
    include: { medication: { select: { name: true } } },
  });
  if (reminders.length === 0) return fail('NOT_FOUND', 'No matching reminders found.', 404);

  const userId = reminders[0].userId;
  if (reminders.some((r) => r.userId !== userId)) {
    return fail('VALIDATION', 'All reminders must belong to the same person.');
  }

  const guard = await requireHealthAccess(req, userId);
  if (guard instanceof Response) return guard;

  const pending = reminders.filter((r) => r.status === 'pending');
  if (pending.length === 0) {
    return ok({ confirmed: 0 });
  }

  const now = new Date();
  await prisma.medicationReminder.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { status: 'taken', takenAt: now },
  });

  const elder = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const familyCaregivers = await prisma.familyRelation.findMany({
    where: { elderUserId: userId, receivesCheckin: true, inviteStatus: 'accepted' },
    include: { caregiverUser: { include: { deviceTokens: true } } },
  });
  const tokens = familyCaregivers.flatMap((rel) => rel.caregiverUser.deviceTokens.map((dt) => dt.token));

  if (tokens.length > 0) {
    const slot = getSlotForDate(pending[0].scheduledAt);
    const medNames = pending.map((r) => r.medication.name).join(', ');
    await sendPushToTokens(tokens, {
      title: `${elder?.name ?? 'Your family member'} confirmed ${SLOT_META[slot].label.toLowerCase()} medicines`,
      body: `${pending.length} medicine${pending.length === 1 ? '' : 's'} taken: ${medNames}`,
      channelId: 'reminders',
      data: { type: 'medicine_confirmed', userId },
    });
  }

  return ok({ confirmed: pending.length });
}
