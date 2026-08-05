import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.enum(['yoga', 'exercise', 'meditation']).optional(),
  youtubeUrl: z.string().url().refine((u) => /youtube\.com|youtu\.be/.test(u), 'Must be a YouTube link.').optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please check the details and try again.' } },
      { status: 400 },
    );
  }

  const video = await prisma.wellnessVideo.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: video });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  await prisma.wellnessVideo.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
