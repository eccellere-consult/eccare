import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({ status: z.enum(['going', 'maybe', 'not_going']) });

/** RSVP to a community event. Idempotent — re-sending updates the existing response. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please choose going, maybe, or not going.');

  const event = await prisma.communityEvent.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } },
      { status: 404 },
    );
  }

  // Gate on the event's own neighbourhood, not the caller's primary one — stops a
  // member of community A from RSVPing to community B's event.
  const guard = await requireMembership(req, { neighborhoodId: event.neighborhoodId });
  if (guard.error) return guard.error;

  const rsvp = await prisma.communityEventRsvp.upsert({
    where: { eventId_userId: { eventId: id, userId: guard.auth.userId } },
    create: { eventId: id, userId: guard.auth.userId, status: parsed.data.status },
    update: { status: parsed.data.status },
  });

  return ok(rsvp);
}
