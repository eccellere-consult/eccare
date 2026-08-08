import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const COVERAGE_TYPES = ['hospital_plan', 'insurance_plan', 'diagnostics', 'wearable_gadget'] as const;

const createSchema = z.object({
  elderUserId: z.string().optional(),
  type: z.enum(COVERAGE_TYPES),
  label: z.string().min(1).max(160),
  provider: z.string().max(160).optional(),
  policyNumber: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
});

/** Optional coverage/device records — hospital plans, insurance, diagnostics
 *  memberships, registered wearables. Informational, same permission tier as
 *  HealthNote (no canManageMeds check). */
export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const items = await prisma.healthCoverageItem.findMany({
    where: { userId: guard.elderUserId },
    include: { addedBy: { select: { name: true, role: true } } },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
  });

  return ok(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { type, label, provider, policyNumber, notes } = parsed.data;

  const item = await prisma.healthCoverageItem.create({
    data: {
      userId: guard.elderUserId,
      addedById: guard.userId,
      type,
      label,
      provider,
      policyNumber,
      notes,
    },
    include: { addedBy: { select: { name: true, role: true } } },
  });

  return ok(item, 201);
}
