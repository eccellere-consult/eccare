import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  name: z.string().min(1).max(120),
  specialty: z.string().min(1).max(120),
  qualifications: z.string().max(1000).optional(),
  background: z.string().max(2000).optional(),
  locality: z.string().max(160).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  mapsLink: z.string().url().optional(),
  phone: z.string().min(3).max(20),
  consultationFee: z.number().nonnegative(),
  neighborhoodId: z.string().optional(),
});

/** Local doctors directory. Read by any member — includes each doctor's own
 *  still-open (unbooked, future) slots inline, so the browse view doesn't need
 *  a second round-trip per doctor to know what's actually bookable. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const doctors = await prisma.localDoctor.findMany({
    where: { neighborhoodId: guard.neighborhoodId, isActive: true },
    include: {
      slots: { where: { isBooked: false, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  return ok(doctors);
}

/** Committee/admin only — same reasoning as helplines/auto-drivers. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput(parsed.error.issues[0]?.message);

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { neighborhoodId: _omit, ...data } = parsed.data;
  const doctor = await prisma.localDoctor.create({
    data: { ...data, neighborhoodId: guard.neighborhoodId, addedById: guard.auth.userId },
  });

  return ok(doctor, 201);
}
