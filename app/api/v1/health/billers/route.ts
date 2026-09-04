import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const BILLER_TYPES = ['electricity', 'water', 'property_tax', 'cable_tv', 'mobile', 'insurance', 'other'] as const;

const createSchema = z.object({
  elderUserId: z.string().optional(),
  billerType: z.enum(BILLER_TYPES),
  billerName: z.string().min(1).max(120),
  consumerNumber: z.string().min(1).max(60),
  nickname: z.string().max(80).optional(),
  autopayEnabled: z.boolean().optional(),
});

/** Linked utility/service billers — same caregiver-writes/elder-reads
 *  permission tier as the rest of Health Essentials (no canManageMeds gate). */
export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const billers = await prisma.linkedBiller.findMany({
    where: { elderUserId: guard.elderUserId },
    include: { bills: { where: { status: 'due' }, orderBy: { dueDate: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return ok(billers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0]?.message || 'Please check the details.');

  const { elderUserId: _omit, ...data } = parsed.data;
  const biller = await prisma.linkedBiller.create({
    data: { ...data, elderUserId: guard.elderUserId, addedById: guard.userId },
  });

  return ok(biller, 201);
}
