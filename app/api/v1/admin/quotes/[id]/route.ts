import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  text: z.string().min(1).optional(),
  author: z.string().nullable().optional(),
});

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const existing = await prisma.dailyQuote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Quote not found.' } }, { status: 404 });
  }

  const quote = await prisma.dailyQuote.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: quote });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.dailyQuote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Quote not found.' } }, { status: 404 });
  }

  await prisma.dailyQuote.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
