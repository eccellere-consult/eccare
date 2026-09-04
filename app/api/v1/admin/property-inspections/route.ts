import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  subscriptionId: z.string(),
  plumbingStatus: z.enum(['pass', 'fail', 'needs_attention']),
  electricalStatus: z.enum(['pass', 'fail', 'needs_attention']),
  structuralStatus: z.enum(['pass', 'fail', 'needs_attention']),
  notes: z.string().max(3000).optional(),
  repairEstimates: z
    .array(z.object({ itemDescription: z.string().min(1).max(300), estimatedCost: z.number().nonnegative() }))
    .max(20)
    .optional(),
});

/** Field agents have no login — an admin submits the report on their behalf
 *  (see the schema comment on PropertyInspection). Repair estimates are
 *  created inline in the same request, not added separately afterward. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0]?.message || 'Please check the details.');

  const subscription = await prisma.propertySubscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!subscription) return fail('NOT_FOUND', 'Subscription not found.', 404);

  const { repairEstimates, ...inspectionData } = parsed.data;
  const inspection = await prisma.propertyInspection.create({
    data: {
      ...inspectionData,
      mediaPaths: [],
      submittedById: auth.userId,
      ...(repairEstimates?.length ? { repairEstimates: { create: repairEstimates } } : {}),
    },
    include: { repairEstimates: true },
  });

  return NextResponse.json({ success: true, data: inspection }, { status: 201 });
}
