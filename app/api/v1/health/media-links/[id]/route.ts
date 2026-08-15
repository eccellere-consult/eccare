import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  mediaType: z.enum(['video', 'music']).optional(),
  description: z.string().max(1000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await prisma.familyMediaLink.findUnique({ where: { id }, select: { userId: true } });
  if (!link) return fail('NOT_FOUND', 'Link not found.', 404);

  const guard = await requireHealthAccess(req, link.userId);
  if (guard instanceof Response) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const updated = await prisma.familyMediaLink.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await prisma.familyMediaLink.findUnique({ where: { id }, select: { userId: true } });
  if (!link) return fail('NOT_FOUND', 'Link not found.', 404);

  const guard = await requireHealthAccess(req, link.userId);
  if (guard instanceof Response) return guard;

  await prisma.familyMediaLink.delete({ where: { id } });
  return ok({ deleted: true });
}
