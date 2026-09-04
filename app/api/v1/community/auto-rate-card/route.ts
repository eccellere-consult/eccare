import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  perKmRate: z.number().positive(),
  perMinWaitRate: z.number().nonnegative(),
  neighborhoodId: z.string().optional(),
});

/** One rate card per community. Read by any member; set by committee/admin. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const rateCard = await prisma.autoRateCard.findUnique({ where: { neighborhoodId: guard.neighborhoodId } });
  return ok(rateCard);
}

/** Upsert — there's exactly one rate card per community, so setting it again
 *  just replaces the previous rates rather than needing a separate edit route. */
export async function PUT(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter both rates as positive numbers.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { perKmRate, perMinWaitRate } = parsed.data;

  const rateCard = await prisma.autoRateCard.upsert({
    where: { neighborhoodId: guard.neighborhoodId },
    create: { neighborhoodId: guard.neighborhoodId, perKmRate, perMinWaitRate },
    update: { perKmRate, perMinWaitRate },
  });

  return ok(rateCard);
}
