import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const schema = z.object({ action: z.enum(['acknowledge', 'resolve']) });

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/**
 * Someone answers an SOS / panic alert.
 *  - `acknowledge` ("I'm on it"): the alarm stops on everybody's screen, because the live banner
 *    only rings for alerts still in the `triggered` state. The alert stays open.
 *  - `resolve` ("All safe now"): closes the alert.
 * Allowed for the person who raised it, their accepted family, their linked emergency contacts, and
 * the committee/admin of the community a panic alert was raised in. Nothing else changes: no schema
 * change, `status`, `acknowledgedBy` and `resolvedAt` already exist on SOSEvent.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Invalid request.', 400);

  const event = await prisma.sOSEvent.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, neighborhoodId: true },
  });
  if (!event) return fail('NOT_FOUND', 'Alert not found.', 404);

  let allowed = await canAccessElder(auth.userId, event.userId);
  if (!allowed) {
    const linked = await prisma.emergencyContact.findFirst({
      where: { userId: event.userId, linkedUserId: auth.userId },
      select: { id: true },
    });
    allowed = Boolean(linked);
  }
  if (!allowed && event.neighborhoodId) {
    const manager = await prisma.neighborhoodMember.findFirst({
      where: {
        neighborhoodId: event.neighborhoodId,
        userId: auth.userId,
        status: 'approved',
        role: { in: ['committee', 'admin'] },
      },
      select: { id: true },
    });
    allowed = Boolean(manager);
  }
  if (!allowed) return fail('FORBIDDEN', 'You cannot answer this alert.', 403);

  // Already closed: nothing to do, and never re-open or downgrade a resolved alert.
  if (event.status === 'resolved') return NextResponse.json({ success: true, data: { id, status: 'resolved' } });

  if (parsed.data.action === 'acknowledge') {
    if (event.status === 'acknowledged') return NextResponse.json({ success: true, data: { id, status: 'acknowledged' } });
    await prisma.sOSEvent.update({ where: { id }, data: { status: 'acknowledged', acknowledgedBy: auth.userId } });
    return NextResponse.json({ success: true, data: { id, status: 'acknowledged' } });
  }

  await prisma.sOSEvent.update({
    where: { id },
    data: { status: 'resolved', resolvedAt: new Date(), acknowledgedBy: event.status === 'triggered' ? auth.userId : undefined },
  });
  return NextResponse.json({ success: true, data: { id, status: 'resolved' } });
}
