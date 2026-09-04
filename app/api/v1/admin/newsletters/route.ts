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

const createSchema = z.object({
  title: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  audience: z.enum(['all_caregivers', 'all_volunteers', 'all_elders', 'everyone']).default('everyone'),
  scheduledFor: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const newsletters = await prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ success: true, data: newsletters });
}

/** Always creates as 'draft' — scheduling/publishing are separate explicit
 *  actions (PATCH .../schedule, POST .../publish), not something that happens
 *  implicitly at creation time. */
export async function POST(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please check the details.' } }, { status: 400 });
  }

  const { scheduledFor, ...rest } = parsed.data;
  const newsletter = await prisma.newsletter.create({
    data: {
      ...rest,
      status: scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      createdById: auth!.userId,
    },
  });

  return NextResponse.json({ success: true, data: newsletter }, { status: 201 });
}
