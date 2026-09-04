import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(3).max(20),
  vehicleNumber: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
  neighborhoodId: z.string().optional(),
});

/** Auto-rickshaw drivers vetted for the community. Read by any member; booking
 *  is a WhatsApp handoff from the client, not a route here. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const drivers = await prisma.autoDriver.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(drivers);
}

/** Committee/admin only — same reasoning as helplines: a wrong number here sends
 *  an elder's ride request to a stranger. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name and phone number.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { name, phone, vehicleNumber, sortOrder } = parsed.data;

  const driver = await prisma.autoDriver.create({
    data: { neighborhoodId: guard.neighborhoodId, name, phone, vehicleNumber, sortOrder: sortOrder ?? 0 },
  });

  return ok(driver, 201);
}
