import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

const schema = z.object({
  name: z.string().min(1).max(160).optional(),
  firmName: z.string().max(160).nullable().optional(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Please check the details.' } }, { status: 400 });

  const expert = await prisma.advisoryExpert.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: expert });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  await prisma.advisoryExpert.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
