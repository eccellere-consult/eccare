import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRating } from '@/lib/ratings';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });
const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });

const schema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

/** Customer-side closure: confirms the visit happened and rates the doctor,
 *  once paid AND the slot's own scheduled time has passed — no separate
 *  provider-side "delivered" step exists for a single appointment (the
 *  clinic may have no login at all, same reasoning as the confirm step). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please give a star rating between 1 and 5.', 400);

  const booking = await prisma.doctorBooking.findUnique({
    where: { id },
    include: { slot: true, doctor: { select: { providerId: true } } },
  });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (!(await canAccessElder(auth.userId, booking.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this booking.", 403);
  }
  if (booking.status !== 'paid') {
    return fail('INVALID_STATE', 'This booking can only be closed once it has been paid.', 409);
  }
  if (booking.slot.startsAt > new Date()) {
    return fail('TOO_EARLY', "You can confirm this visit once the appointment's scheduled time has passed.", 409);
  }

  const updated = await prisma.doctorBooking.update({ where: { id }, data: { status: 'closed' } });
  await createRating({
    providerId: booking.doctor.providerId,
    raterUserId: auth.userId,
    stars: parsed.data.stars,
    comment: parsed.data.comment,
    context: { doctorBookingId: id },
  });

  return ok(updated);
}
