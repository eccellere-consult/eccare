import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const updateSchema = z.object({
  status: z.enum(['fulfilled', 'cancelled']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const foodReq = await prisma.foodRequest.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!foodReq) return fail('NOT_FOUND', 'Food request not found.', 404);
  if (foodReq.status !== 'requested') {
    return fail('ALREADY_HANDLED', `This request is already ${foodReq.status}.`);
  }

  const guard = await requireHealthAccess(req, foodReq.userId);
  if (guard instanceof Response) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const updated = await prisma.foodRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      handledBy: guard.userId,
    },
  });

  return ok(updated);
}
