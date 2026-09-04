import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const updateSchema = z.object({
  billerName: z.string().min(1).max(120).optional(),
  consumerNumber: z.string().min(1).max(60).optional(),
  nickname: z.string().max(80).nullable().optional(),
  autopayEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const biller = await prisma.linkedBiller.findUnique({ where: { id } });
  if (!biller) return fail('NOT_FOUND', 'Biller not found.', 404);

  const guard = await requireHealthAccess(req, biller.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details.');

  const updated = await prisma.linkedBiller.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const biller = await prisma.linkedBiller.findUnique({ where: { id } });
  if (!biller) return fail('NOT_FOUND', 'Biller not found.', 404);

  const guard = await requireHealthAccess(req, biller.elderUserId);
  if (guard instanceof Response) return guard;

  await prisma.linkedBiller.delete({ where: { id } });
  return ok(null);
}
