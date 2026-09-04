import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { createDirectoryProvider } from '@/lib/provider-directory';

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(3).max(20),
  whatsapp: z.string().max(20).optional(),
  vehicleNumber: z.string().max(20).optional(),
  serviceArea: z.string().max(160).optional(),
  perKmRate: z.number().positive().optional(),
  perMinWaitRate: z.number().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  neighborhoodId: z.string().optional(),
});

/** Auto-rickshaw drivers vetted for the community. Read by any member; booking
 *  is a WhatsApp handoff from the client, not a route here — the driver
 *  confirms availability directly over WhatsApp, no in-app dispatch. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const drivers = await prisma.autoDriver.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { provider: { select: { verificationStatus: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(drivers);
}

/** Committee/admin only — same reasoning as helplines/doctors: a wrong number
 *  here sends an elder's ride request to a stranger. Also creates a linked
 *  placeholder ServiceProvider (see lib/provider-directory) purely to reuse
 *  the existing verification/admin-approval machinery. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name and phone number.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { neighborhoodId: _omit, ...data } = parsed.data;

  const driver = await prisma.$transaction(async (tx) => {
    const provider = await createDirectoryProvider(tx, {
      name: data.name,
      category: 'auto_transport',
      serviceArea: data.serviceArea,
      phone: data.phone,
    });
    return tx.autoDriver.create({
      data: { ...data, neighborhoodId: guard.neighborhoodId, providerId: provider.id, sortOrder: data.sortOrder ?? 0 },
      include: { provider: { select: { verificationStatus: true } } },
    });
  });

  return ok(driver, 201);
}
