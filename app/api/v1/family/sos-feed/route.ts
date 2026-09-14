import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * Recent SOS/panic events across every elder this caregiver is linked to
 * (accepted FamilyRelation, receivesSos) — purpose-built for
 * components/sos-alert-banner.tsx's poll, since the caregiver-scoped
 * GET /api/v1/emergency/sos only covers one elder at a time via
 * ?elderUserId=. Caps at the 10 most recent across all elders combined;
 * the banner only cares about "is there something new," not a full history
 * (that's /family/sos-history/[elderId]).
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const relations = await prisma.familyRelation.findMany({
    where: { caregiverUserId: auth.userId, receivesSos: true, inviteStatus: 'accepted' },
    select: { elderUserId: true },
  });
  const elderUserIds = relations.map((r) => r.elderUserId);
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
