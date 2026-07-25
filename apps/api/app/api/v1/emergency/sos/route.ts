import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { sendPushToTokens } from '@/lib/fcm';
import { z } from 'zod';

const schema = z.object({
  triggerType: z.string().default('manual'),
  lat: z.number().optional(),
  lng: z.number().optional(),
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
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid request.' } },
      { status: 400 },
    );
  }

  const elder = await prisma.user.findUnique({ where: { id: auth.userId } });

  const sosEvent = await prisma.sOSEvent.create({
    data: {
      userId: auth.userId,
      triggerType: parsed.data.triggerType,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    },
  });

  // Notify all emergency contacts and family caregivers
  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: auth.userId, notifyOnSos: true },
  });
  const familyCaregivers = await prisma.familyRelation.findMany({
    where: { elderUserId: auth.userId, receivesSos: true, inviteStatus: 'accepted' },
    include: { caregiverUser: { include: { deviceTokens: true } } },
  });

  const caregiverTokens = familyCaregivers.flatMap((rel) =>
    rel.caregiverUser.deviceTokens.map((dt) => dt.token),
  );

  const pushResult = await sendPushToTokens(caregiverTokens, {
    title: `${elder?.name ?? 'Your family member'} needs help`,
    body:
      parsed.data.lat && parsed.data.lng
        ? 'Emergency alert triggered. Location shared — open EC to see details.'
        : 'Emergency alert triggered. Open EC to see details.',
    channelId: 'emergency',
    data: { type: 'sos', sosEventId: sosEvent.id },
  });

  // TODO: Send SMS to emergency contacts once an SMS provider is chosen

  return NextResponse.json({
    success: true,
    data: {
      sosEvent,
      notifiedContacts: contacts.length,
      notifiedCaregivers: familyCaregivers.length,
      pushSent: pushResult.sent,
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const events = await prisma.sOSEvent.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ success: true, data: events });
}
