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

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  audience: z.enum(['all_caregivers', 'all_volunteers', 'all_elders', 'everyone']).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.newsletter.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Newsletter not found.' } }, { status: 404 });
  if (existing.status === 'published') {
    return NextResponse.json({ success: false, error: { code: 'ALREADY_PUBLISHED', message: 'A published newsletter cannot be edited.' } }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Please check the details.' } }, { status: 400 });

  const { scheduledFor, ...rest } = parsed.data;
  const newsletter = await prisma.newsletter.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduledFor !== undefined
        ? { scheduledFor: scheduledFor ? new Date(scheduledFor) : null, status: scheduledFor ? 'scheduled' : 'draft' }
        : {}),
    },
  });

  return NextResponse.json({ success: true, data: newsletter });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  await prisma.newsletter.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
