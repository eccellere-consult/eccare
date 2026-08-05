import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(1_000_000).optional(),
  category: z.string().max(60).optional(),
  inStock: z.boolean().optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

async function loadOwnItem(req: NextRequest, id: string) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'provider') return { error: fail('FORBIDDEN', 'Providers only.', 403) };

  const item = await prisma.catalogItem.findUnique({ where: { id }, include: { provider: true } });
  if (!item) return { error: fail('NOT_FOUND', 'Item not found.', 404) };
  if (item.provider.userId !== auth.userId) {
    return { error: fail('FORBIDDEN', "You don't have access to this item.", 403) };
  }

  return { item };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await loadOwnItem(req, id);
  if (error) return error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please check the details and try again.', 400);

  const updated = await prisma.catalogItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await loadOwnItem(req, id);
  if (error) return error;

  await prisma.catalogItem.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
