import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const patchSchema = z.object({
  label: z.string().min(1).max(160).optional(),
  provider: z.string().max(160).nullable().optional(),
  policyNumber: z.string().max(160).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.healthCoverageItem.findUnique({ where: { id } });
  if (!item) return fail('NOT_FOUND', 'Not found.', 404);

  const guard = await requireHealthAccess(req, item.userId);
  if (guard instanceof Response) return guard;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const updated = await prisma.healthCoverageItem.update({
    where: { id },
    data: parsed.data,
    include: { addedBy: { select: { name: true, role: true } } },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.healthCoverageItem.findUnique({ where: { id } });
  if (!item) return fail('NOT_FOUND', 'Not found.', 404);

  const guard = await requireHealthAccess(req, item.userId);
  if (guard instanceof Response) return guard;

  await prisma.healthCoverageItem.delete({ where: { id } });

  return ok({ deleted: true });
}
