import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  driverId: z.string(),
  elderUserId: z.string().optional(),
  pickupAddress: z.string().min(1).max(500),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropAddress: z.string().min(1).max(500),
  dropLat: z.number().min(-90).max(90).optional(),
  dropLng: z.number().min(-180).max(180).optional(),
  // No route/distance calculation exists anywhere in this app (no maps or
  // geocoding dependency) — same "agree the exact fare with the driver"
  // reality the existing WhatsApp-handoff copy already states. The
  // caregiver/elder enters the agreed fare themselves, same trust level as
  // the indicative per-km rate already shown before this booking existed.
  // Pickup/drop coordinates are optional map tags (like sharing a pin in
  // Uber) captured via the browser's geolocation API — purely informational
  // for the driver, no routing/ETA is computed from them.
  fareAmount: z.number().positive(),
});

/** Every booking the caller can see — either as the elder it's for, or as
 *  the caregiver who booked it on an elder's behalf. Same shape as
 *  GET /api/v1/community/doctor-bookings. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const bookings = await prisma.autoBooking.findMany({
    where: { OR: [{ elderUserId: guard.auth.userId }, { bookedById: guard.auth.userId }] },
    include: { driver: { select: { name: true, phone: true, vehicleNumber: true } }, rating: true },
    orderBy: { createdAt: 'desc' },
  });

  return ok(bookings);
}

/** A caregiver may book on behalf of any elder they have an accepted
 *  FamilyRelation with (elderUserId in the body); omitting it books for the
 *  caller themself. Requires membership in the SAME neighbourhood as the
 *  driver — same reasoning as doctor-bookings' slot.doctor.neighborhoodId
 *  guard. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please fill in the pickup, drop, and fare.', 400);

  const driver = await prisma.autoDriver.findUnique({ where: { id: parsed.data.driverId } });
  if (!driver) return fail('NOT_FOUND', 'Driver not found.', 404);

  const guard = await requireMembership(req, { neighborhoodId: driver.neighborhoodId });
  if (guard.error) return guard.error;

  if (!driver.isAvailable) return fail('NOT_AVAILABLE', 'This driver is currently marked unavailable.', 409);

  const elderUserId = parsed.data.elderUserId ?? guard.auth.userId;
  if (elderUserId !== guard.auth.userId) {
    const allowed = await canAccessElder(guard.auth.userId, elderUserId);
    if (!allowed) return fail('FORBIDDEN', 'You do not have access to this elder profile.', 403);
  }

  const booking = await prisma.autoBooking.create({
    data: {
      driverId: driver.id,
      elderUserId,
      bookedById: guard.auth.userId,
      pickupAddress: parsed.data.pickupAddress,
      pickupLat: parsed.data.pickupLat,
      pickupLng: parsed.data.pickupLng,
      dropAddress: parsed.data.dropAddress,
      dropLat: parsed.data.dropLat,
      dropLng: parsed.data.dropLng,
      fareAmount: parsed.data.fareAmount,
    },
    include: { driver: { select: { name: true, phone: true, vehicleNumber: true } }, rating: true },
  });

  return ok(booking, 201);
}
