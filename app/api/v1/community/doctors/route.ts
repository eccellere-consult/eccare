import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { createDirectoryProvider } from '@/lib/provider-directory';

const schema = z.object({
  name: z.string().min(1).max(120),
  specialty: z.string().min(1).max(120),
  clinicName: z.string().max(200).optional(),
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
 *  a second round-trip per doctor to know what's actually bookable. Optional
 *  `?q=` does a simple name/specialty/clinic/locality search — "keep the
 *  initial search simple" per spec, no separate filter endpoints. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const q = req.nextUrl.searchParams.get('q')?.trim();

  const doctors = await prisma.localDoctor.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { specialty: { contains: q } },
              { clinicName: { contains: q } },
              { locality: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      slots: { where: { isBooked: false, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
      provider: { select: { verificationStatus: true } },
    },
    orderBy: { name: 'asc' },
  });

  return ok(doctors);
}

/** Committee/admin only — same reasoning as helplines/auto-drivers. Also
 *  creates a linked placeholder ServiceProvider (see lib/provider-directory),
 *  purely so verification reuses the existing admin approval queue rather
 *  than needing a parallel one just for doctors. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput(parsed.error.issues[0]?.message);

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { neighborhoodId: _omit, ...data } = parsed.data;

  const doctor = await prisma.$transaction(async (tx) => {
    const provider = await createDirectoryProvider(tx, {
      name: data.name,
      category: 'doctor',
      serviceArea: data.locality,
      phone: data.phone,
    });
    return tx.localDoctor.create({
      data: { ...data, neighborhoodId: guard.neighborhoodId, addedById: guard.auth.userId, providerId: provider.id },
      include: { provider: { select: { verificationStatus: true } } },
    });
  });

  return ok(doctor, 201);
}
