import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });
const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });

const schema = z.object({ action: z.enum(['confirm', 'cancel']) });

/** The doctor's clinic has no login (see the schema comment on
 *  DoctorBookingStatus) — confirmation happens by phone/WhatsApp reply to
 *  whoever booked, and *they* mark it here once that call happens. Only the
 *  person who made the booking can do this. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const booking = await prisma.doctorBooking.findUnique({ where: { id } });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.bookedById !== auth.userId) return fail('FORBIDDEN', "This isn't your booking.", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Invalid request.', 400);

  if (parsed.data.action === 'confirm') {
    if (booking.status !== 'pending_confirmation') {
      return fail('INVALID_STATE', 'This booking is not waiting on confirmation.', 400);
    }
    const updated = await prisma.doctorBooking.update({ where: { id }, data: { status: 'confirmed' } });
    return ok(updated);
  }

  // cancel
  if (booking.status === 'paid') {
    return fail('ALREADY_PAID', 'This booking is already paid — contact the clinic directly to cancel.', 400);
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.doctorSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
    return tx.doctorBooking.update({ where: { id }, data: { status: 'cancelled' } });
  });
  return ok(updated);
}
