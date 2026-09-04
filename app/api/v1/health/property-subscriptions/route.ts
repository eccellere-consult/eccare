import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { PROPERTY_REVIEW_RATES } from '@/lib/property-rates';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'biannually']),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const subscriptions = await prisma.propertySubscription.findMany({
    where: { elderUserId: guard.elderUserId },
    include: { inspections: { orderBy: { inspectedAt: 'desc' }, include: { repairEstimates: { include: { invoice: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return ok(subscriptions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', 'Please select a review frequency.');

  const subscription = await prisma.propertySubscription.create({
    data: {
      elderUserId: guard.elderUserId,
      subscribedById: guard.userId,
      frequency: parsed.data.frequency,
      fee: PROPERTY_REVIEW_RATES[parsed.data.frequency],
    },
  });

  return ok(subscription, 201);
}
