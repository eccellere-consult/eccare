import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).default('backlog'),
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

  const items = await prisma.backlogItem.findMany({ orderBy: [{ status: 'asc' }, { position: 'asc' }] });
  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter a title.' } },
      { status: 400 },
    );
  }

  const maxPosition = await prisma.backlogItem.aggregate({
    where: { status: parsed.data.status },
    _max: { position: true },
  });

  const item = await prisma.backlogItem.create({
    data: { ...parsed.data, position: (maxPosition._max.position ?? -1) + 1 },
  });

  return NextResponse.json({ success: true, data: item }, { status: 201 });
}
