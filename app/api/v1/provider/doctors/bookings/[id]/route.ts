import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ action: z.enum(['confirm', 'cancel']) });

/** The doctor confirming or cancelling directly — same status machine as the
 *  booker's own PATCH /community/doctor-bookings/[id], just gated on being
 *  the doctor rather than the person who booked. Real confirmation from the
 *  clinic side is the whole point of self-service replacing the old
 *  no-login "booker phones the clinic and self-reports" path. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const { id } = await params;
  const booking = await prisma.doctorBooking.findUnique({ where: { id }, include: { doctor: true } });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.doctor.providerId !== provider.id) return fail('FORBIDDEN', "This isn't your booking.", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Invalid request.', 400);

  if (parsed.data.action === 'confirm') {
    if (booking.status !== 'pending_confirmation') {
      return fail('INVALID_STATE', 'This booking is not waiting on confirmation.', 400);
    }
    const updated = await prisma.doctorBooking.update({ where: { id }, data: { status: 'confirmed' } });
    return NextResponse.json({ success: true, data: updated });
  }

  // cancel
  if (booking.status === 'paid') {
    return fail('ALREADY_PAID', 'This booking is already paid — contact the patient directly to cancel.', 400);
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.doctorSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
    return tx.doctorBooking.update({ where: { id }, data: { status: 'cancelled' } });
  });
  return NextResponse.json({ success: true, data: updated });
}
