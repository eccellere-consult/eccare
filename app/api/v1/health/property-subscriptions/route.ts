import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { PROPERTY_REVIEW_RATES } from '@/lib/property-rates';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'biannually']),
  providerId: z.string().optional(),
});

const FREQUENCY_FEE_FIELD = {
  monthly: 'monthlyFee',
  quarterly: 'quarterlyFee',
  biannually: 'biannualFee',
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const subscriptions = await prisma.propertySubscription.findMany({
    where: { elderUserId: guard.elderUserId },
    include: {
      provider: { select: { id: true, businessName: true, phone: true } },
      inspections: { orderBy: { inspectedAt: 'desc' }, include: { repairEstimates: { include: { invoice: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(subscriptions);
}

/** With a providerId, this subscribes the elder to a specific verified
 *  Property Management company (that provider's own account then submits
 *  inspections themselves — self-service). Without one, it's the legacy
 *  generic path (admin submits inspections on an unspecified field agent's
 *  behalf) — kept working rather than forcing everyone through provider
 *  selection the moment it existed. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', 'Please select a review frequency.');

  let fee: number = PROPERTY_REVIEW_RATES[parsed.data.frequency];
  let providerId: string | undefined;

  if (parsed.data.providerId) {
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: parsed.data.providerId },
      include: { propertyManagementProfile: true },
    });
    if (!provider || provider.category !== 'property_management' || provider.verificationStatus !== 'verified') {
      return fail('NOT_FOUND', 'That property management provider is not available.', 404);
    }
    providerId = provider.id;
    const customFee = provider.propertyManagementProfile?.[FREQUENCY_FEE_FIELD[parsed.data.frequency]];
    if (customFee != null) fee = Number(customFee);
  }

  const subscription = await prisma.propertySubscription.create({
    data: {
      elderUserId: guard.elderUserId,
      subscribedById: guard.userId,
      frequency: parsed.data.frequency,
      fee,
      providerId,
    },
  });

  return ok(subscription, 201);
}
