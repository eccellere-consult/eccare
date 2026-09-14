import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * Recent SOS/panic events across every elder this person is notified about
 * — either as an accepted family caregiver (FamilyRelation, receivesSos),
 * or as a linked emergency contact (EmergencyContact.linkedUserId, meaning
 * they also have their own EC login and can actually see this banner) —
 * the same two audiences POST /api/v1/emergency/sos already pushes to.
 * Purpose-built for components/sos-alert-banner.tsx's poll, since the
 * elder-scoped GET /api/v1/emergency/sos only covers one elder at a time
 * via ?elderUserId=. Caps at the 10 most recent across all elders
 * combined; the banner only cares about "is there something new," not a
 * full history (that's /family/sos-history/[elderId]).
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const [relations, linkedContacts] = await Promise.all([
    prisma.familyRelation.findMany({
      where: { caregiverUserId: auth.userId, receivesSos: true, inviteStatus: 'accepted' },
      select: { elderUserId: true },
    }),
    prisma.emergencyContact.findMany({
      where: { linkedUserId: auth.userId, notifyOnSos: true },
      select: { userId: true },
    }),
  ]);
  const elderUserIds = [...new Set([...relations.map((r) => r.elderUserId), ...linkedContacts.map((c) => c.userId)])];
  if (elderUserIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const events = await prisma.sOSEvent.findMany({
    where: { userId: { in: elderUserIds } },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({ success: true, data: events });
}
