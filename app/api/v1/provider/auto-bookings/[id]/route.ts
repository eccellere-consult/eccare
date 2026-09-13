import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ action: z.enum(['confirm', 'cancel']) });

/** The driver confirming or cancelling directly — same status machine as the
 *  booker's own PATCH /community/auto-bookings/[id], gated on owning the
 *  AutoDriver row instead. Same shape as provider/doctors/bookings/[id]. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const { id } = await params;
  const booking = await prisma.autoBooking.findUnique({ where: { id }, include: { driver: true } });
  if (!booking) return fail('NOT_FOUND', 'Booking not found.', 404);
  if (booking.driver.providerId !== provider.id) return fail('FORBIDDEN', "This isn't your booking.", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Invalid request.', 400);

  if (parsed.data.action === 'confirm') {
    if (booking.status !== 'pending_confirmation') {
      return fail('INVALID_STATE', 'This booking is not waiting on confirmation.', 400);
    }
    const updated = await prisma.autoBooking.update({ where: { id }, data: { status: 'confirmed' } });
    return NextResponse.json({ success: true, data: updated });
  }

  // cancel
  if (booking.status === 'paid') {
    return fail('ALREADY_PAID', 'This booking is already paid — contact the rider directly to cancel.', 400);
  }
  const updated = await prisma.autoBooking.update({ where: { id }, data: { status: 'cancelled' } });
  return NextResponse.json({ success: true, data: updated });
}
