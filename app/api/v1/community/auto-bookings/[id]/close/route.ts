import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createRating } from '@/lib/ratings';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });
const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });

const schema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

/** Customer-side closure: confirms the ride happened and rates the driver,
 *  once paid. Auto rides are same-day/immediate, unlike a scheduled doctor
 *  appointment, so there's no "wait until the scheduled time" gate here. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please give a star rating between 1 and 5.', 400);

  const booking = await prisma.autoBooking.findUnique({
    where: { id },
    include: { driver: { select: { providerId: true } } },
  });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.bookedById !== auth.userId) return fail('FORBIDDEN', "This isn't your booking.", 403);
  if (booking.status !== 'paid') {
    return fail('INVALID_STATE', 'This booking can only be closed once it has been paid.', 409);
  }

  const updated = await prisma.autoBooking.update({ where: { id }, data: { status: 'closed' } });
  await createRating({
    providerId: booking.driver.providerId,
    raterUserId: auth.userId,
    stars: parsed.data.stars,
    comment: parsed.data.comment,
    context: { autoBookingId: id },
  });

  return ok(updated);
}
