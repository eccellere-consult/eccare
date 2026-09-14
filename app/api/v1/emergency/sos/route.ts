import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { sendPushToTokens } from '@/lib/push';
import { getPrimaryNeighborhoodId } from '@/lib/community-access';
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

  // Same three audiences a community panic alert reaches (see
  // /api/v1/community/panic) — a personal SOS is the same emergency, just
  // raised from the elder's own "Need help now" / ambulance / police
  // buttons instead of the community one, so it notifies the same people:
  // family caregivers, this elder's own emergency contacts (when they're
  // also linked to an EC account, so there's a device to push to), and —
  // if the elder belongs to a residents' community — that community's
  // committee/admin, same as a panic alert would reach them.
  const [contacts, familyCaregivers, neighborhoodId] = await Promise.all([
    prisma.emergencyContact.findMany({
      where: { userId: auth.userId, notifyOnSos: true },
      include: { linkedUser: { include: { deviceTokens: true } } },
    }),
    prisma.familyRelation.findMany({
      where: { elderUserId: auth.userId, receivesSos: true, inviteStatus: 'accepted' },
      include: { caregiverUser: { include: { deviceTokens: true } } },
    }),
    getPrimaryNeighborhoodId(auth.userId),
  ]);

  const sosEvent = await prisma.sOSEvent.create({
    data: {
      userId: auth.userId,
      triggerType: parsed.data.triggerType,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      // Set whenever the elder belongs to a community, same as a panic
      // alert always does — the committee is notified either way (see
      // below), so this keeps "neighborhoodId is set" in sync with "the
      // community's committee was told about this event," which is what
      // the committee's live alert banner (GET /community/panic) polls by.
      neighborhoodId: neighborhoodId ?? undefined,
    },
  });

  const committee = neighborhoodId
    ? await prisma.neighborhoodMember.findMany({
        where: { neighborhoodId, role: { in: ['committee', 'admin'] }, userId: { not: auth.userId } },
        include: { user: { include: { deviceTokens: true } } },
      })
    : [];

  const pushTokens = [
    ...familyCaregivers.flatMap((rel) => rel.caregiverUser.deviceTokens.map((dt) => dt.token)),
    ...contacts.flatMap((c) => c.linkedUser?.deviceTokens.map((dt) => dt.token) ?? []),
    ...committee.flatMap((m) => m.user.deviceTokens.map((dt) => dt.token)),
  ];

  const pushResult = await sendPushToTokens([...new Set(pushTokens)], {
    title: `${elder?.name ?? 'Your family member'} needs help`,
    body:
      parsed.data.lat && parsed.data.lng
        ? 'Emergency alert triggered. Location shared — open EC to see details.'
        : 'Emergency alert triggered. Open EC to see details.',
    channelId: 'emergency',
    data: { type: 'sos', sosEventId: sosEvent.id },
  });

  // Recipients for the client to auto-open a pre-filled WhatsApp chat to
  // (see components/emergency-actions.tsx) — everyone above who has a phone
  // number on file, regardless of whether they're also linked to an EC
  // account (unlike push, WhatsApp only needs a number). Deduped by phone
  // so the same person on two lists (e.g. a caregiver who's also saved as
  // an emergency contact) isn't messaged twice.
  const whatsappRecipients = dedupeByPhone([
    ...contacts.map((c) => ({ name: c.name, phone: c.phone })),
    ...familyCaregivers.map((rel) => ({ name: rel.caregiverUser.name, phone: rel.caregiverUser.phone })),
    ...committee.map((m) => ({ name: m.user.name, phone: m.user.phone })),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      sosEvent,
      notifiedContacts: contacts.length,
      notifiedCaregivers: familyCaregivers.length,
      notifiedCommittee: committee.length,
      pushSent: pushResult.sent,
      whatsappRecipients,
    },
  });
}

function dedupeByPhone(list: Array<{ name: string; phone: string | null }>) {
  const seen = new Set<string>();
  const out: Array<{ name: string; phone: string }> = [];
  for (const { name, phone } of list) {
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ name, phone });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const elderUserId = req.nextUrl.searchParams.get('elderUserId');

  let targetUserId = auth.userId;
  if (elderUserId && elderUserId !== auth.userId) {
    const relation = await prisma.familyRelation.findUnique({
      where: { elderUserId_caregiverUserId: { elderUserId, caregiverUserId: auth.userId } },
    });
    if (!relation || relation.inviteStatus !== 'accepted') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder's history." } },
        { status: 403 },
      );
    }
    targetUserId = elderUserId;
  }

  const events = await prisma.sOSEvent.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ success: true, data: events });
}
