import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ slotId: z.string() });

/** The caller's own bookings — v1 books for yourself only (elderUserId is always
 *  the caller), not proxy-booking on behalf of a linked elder. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const bookings = await prisma.doctorBooking.findMany({
    where: { elderUserId: guard.auth.userId },
    include: { doctor: { select: { name: true, specialty: true, phone: true } }, slot: true },
    orderBy: { createdAt: 'desc' },
  });

  return ok(bookings);
}

/** Claims a slot atomically — the transaction's conditional update (only where
 *  isBooked is still false) is what actually prevents two people racing for the
 *  same slot, not the isBooked read beforehand. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please pick a slot.', 400);

  const slot = await prisma.doctorSlot.findUnique({ where: { id: parsed.data.slotId }, include: { doctor: true } });
  if (!slot) return fail('NOT_FOUND', 'Slot not found.', 404);

  const guard = await requireMembership(req, { neighborhoodId: slot.doctor.neighborhoodId });
  if (guard.error) return guard.error;

  if (slot.isBooked) return fail('SLOT_TAKEN', 'This slot was just booked by someone else. Please pick another.', 409);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const claim = await tx.doctorSlot.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
      if (claim.count === 0) throw new Error('SLOT_TAKEN');

      return tx.doctorBooking.create({
        data: {
          doctorId: slot.doctorId,
          slotId: slot.id,
          elderUserId: guard.auth.userId,
          bookedById: guard.auth.userId,
          amount: slot.doctor.consultationFee,
        },
        include: { doctor: { select: { name: true, specialty: true, phone: true } }, slot: true },
      });
    });

    return ok(booking, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'SLOT_TAKEN') {
      return fail('SLOT_TAKEN', 'This slot was just booked by someone else. Please pick another.', 409);
    }
    throw err;
  }
}
