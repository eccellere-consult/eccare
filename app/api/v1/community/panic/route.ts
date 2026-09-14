import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendPushToTokens } from '@/lib/push';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  neighborhoodId: z.string().optional(),
});

/**
 * Community panic alert — single tap, notifies the resident's own family/caregivers
 * and emergency contacts (same three audiences a personal SOS reaches — see
 * /api/v1/emergency/sos) *and* the neighbourhood's committee.
 *
 * Recorded as a SOSEvent with neighborhoodId set, rather than a separate model, so
 * the admin SOS feed and any "did help arrive?" audit stay complete by construction.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { lat, lng } = parsed.data;

  const [user, sosEvent] = await Promise.all([
    prisma.user.findUnique({ where: { id: guard.auth.userId } }),
    prisma.sOSEvent.create({
      data: {
        userId: guard.auth.userId,
        triggerType: 'community_panic',
        neighborhoodId: guard.neighborhoodId,
        lat,
        lng,
      },
    }),
  ]);

  // Three audiences: the resident's own caregivers, their own emergency
  // contacts (when linked to an EC account, for push), and the community's
  // committee.
  const [contacts, familyCaregivers, committee] = await Promise.all([
    prisma.emergencyContact.findMany({
      where: { userId: guard.auth.userId, notifyOnSos: true },
      include: { linkedUser: { include: { deviceTokens: true } } },
    }),
    prisma.familyRelation.findMany({
      where: { elderUserId: guard.auth.userId, receivesSos: true, inviteStatus: 'accepted' },
      include: { caregiverUser: { include: { deviceTokens: true } } },
    }),
    prisma.neighborhoodMember.findMany({
      where: {
        neighborhoodId: guard.neighborhoodId,
        role: { in: ['committee', 'admin'] },
        userId: { not: guard.auth.userId },
      },
      include: { user: { include: { deviceTokens: true } } },
    }),
  ]);

  const tokens = [
    ...familyCaregivers.flatMap((r) => r.caregiverUser.deviceTokens.map((d) => d.token)),
    ...contacts.flatMap((c) => c.linkedUser?.deviceTokens.map((d) => d.token) ?? []),
    ...committee.flatMap((m) => m.user.deviceTokens.map((d) => d.token)),
  ];

  const pushResult = await sendPushToTokens([...new Set(tokens)], {
    title: `${user?.name ?? 'A resident'} needs help`,
    body: lat && lng
      ? 'Panic alert raised in your community. Location shared — open EC for details.'
      : 'Panic alert raised in your community. Open EC for details.',
    channelId: 'emergency',
    data: { type: 'community_panic', sosEventId: sosEvent.id },
  });

  // Same phone-based WhatsApp recipient list as a personal SOS (see
  // /api/v1/emergency/sos) — everyone above with a phone on file, deduped.
  const whatsappRecipients = dedupeByPhone([
    ...contacts.map((c) => ({ name: c.name, phone: c.phone })),
    ...familyCaregivers.map((r) => ({ name: r.caregiverUser.name, phone: r.caregiverUser.phone })),
    ...committee.map((m) => ({ name: m.user.name, phone: m.user.phone })),
  ]);

  return ok({
    sosEvent,
    notifiedCaregivers: familyCaregivers.length,
    notifiedContacts: contacts.length,
    notifiedCommittee: committee.length,
    pushSent: pushResult.sent,
    whatsappRecipients,
  }, 201);
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

/** Recent panic alerts in the community — committee-only, it's everyone's incident data. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const events = await prisma.sOSEvent.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok(events);
}
