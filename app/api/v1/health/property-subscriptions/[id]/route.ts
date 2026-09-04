import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const schema = z.object({ status: z.enum(['active', 'paused', 'cancelled']) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.propertySubscription.findUnique({ where: { id } });
  if (!sub) return fail('NOT_FOUND', 'Subscription not found.', 404);

  const guard = await requireHealthAccess(req, sub.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please select a valid status.');

  const updated = await prisma.propertySubscription.update({ where: { id }, data: { status: parsed.data.status } });
  return ok(updated);
}
