import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ slotId: z.string(), elderUserId: z.string().optional() });

/** Every booking the caller can see — either as the elder it's for, or as the
 *  caregiver who booked it on an elder's behalf. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const bookings = await prisma.doctorBooking.findMany({
    where: { OR: [{ elderUserId: guard.auth.userId }, { bookedById: guard.auth.userId }] },
    include: { doctor: { select: { name: true, specialty: true, phone: true, locality: true, clinicName: true, mapsLink: true } }, slot: true },
    orderBy: { createdAt: 'desc' },
  });

  return ok(bookings);
}

/** Claims a slot atomically — the transaction's conditional update (only where
 *  isBooked is still false) is what actually prevents two people racing for the
 *  same slot, not the isBooked read beforehand. A caregiver may book on behalf
 *  of any elder they have an accepted FamilyRelation with (elderUserId in the
 *  body); omitting it books for the caller themself. Also drops a Reminder for
 *  the elder ahead of the appointment, reusing the existing polled-reminder
 *  system (voice/reminders/due) rather than building new delivery. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please pick a slot.', 400);

  const slot = await prisma.doctorSlot.findUnique({
    where: { id: parsed.data.slotId },
    include: { doctor: { include: { provider: { select: { verificationStatus: true } } } } },
  });
  if (!slot) return fail('NOT_FOUND', 'Slot not found.', 404);

  const guard = await requireMembership(req, { neighborhoodId: slot.doctor.neighborhoodId });
  if (guard.error) return guard.error;

  if (slot.doctor.provider && slot.doctor.provider.verificationStatus !== 'verified') {
    return fail('NOT_VERIFIED', 'This doctor is still pending verification and cannot be booked yet.', 403);
  }

  if (slot.isBooked) return fail('SLOT_TAKEN', 'This slot was just booked by someone else. Please pick another.', 409);

  const targetElderId = parsed.data.elderUserId ?? guard.auth.userId;
  if (targetElderId !== guard.auth.userId) {
    const allowed = await canAccessElder(guard.auth.userId, targetElderId);
    if (!allowed) return fail('FORBIDDEN', 'You do not have access to this elder profile.', 403);
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const claim = await tx.doctorSlot.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
      if (claim.count === 0) throw new Error('SLOT_TAKEN');

      const created = await tx.doctorBooking.create({
        data: {
          doctorId: slot.doctorId,
          slotId: slot.id,
          elderUserId: targetElderId,
          bookedById: guard.auth.userId,
          amount: slot.doctor.consultationFee,
        },
        include: { doctor: { select: { name: true, specialty: true, phone: true, locality: true, clinicName: true, mapsLink: true } }, slot: true },
      });

      // Never schedule a reminder in the past (a slot booked less than 2 hours
      // out); fire it almost immediately instead of skipping it.
      const remindAt = new Date(Math.max(Date.now() + 60_000, slot.startsAt.getTime() - 2 * 60 * 60 * 1000));
      await tx.reminder.create({
        data: {
          userId: targetElderId,
          message: `Appointment with Dr. ${slot.doctor.name} (${slot.doctor.specialty}) at ${slot.startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`,
          remindAt,
        },
      });

      return created;
    });

    return ok(booking, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'SLOT_TAKEN') {
      return fail('SLOT_TAKEN', 'This slot was just booked by someone else. Please pick another.', 409);
    }
    throw err;
  }
}
