import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  youtubeUrl: z.string().url().refine((u) => /youtube\.com|youtu\.be/.test(u), 'Must be a YouTube link.'),
  description: z.string().max(2000).optional(),
  position: z.number().int().optional(),
});

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const videos = await prisma.helpGuideVideo.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] });
  return NextResponse.json({ success: true, data: videos });
}

export async function POST(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please check the details and try again.' } },
      { status: 400 },
    );
  }

  const video = await prisma.helpGuideVideo.create({
    data: { ...parsed.data, addedById: auth!.userId },
  });

  return NextResponse.json({ success: true, data: video }, { status: 201 });
}
