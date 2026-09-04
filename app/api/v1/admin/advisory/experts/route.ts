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
  category: z.enum(['legal_will', 'reverse_mortgage', 'senior_insurance']),
  name: z.string().min(1).max(160),
  firmName: z.string().max(160).optional(),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  bio: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const experts = await prisma.advisoryExpert.findMany({ orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] });
  return NextResponse.json({ success: true, data: experts });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please check the details.' } }, { status: 400 });
  }

  const expert = await prisma.advisoryExpert.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: expert }, { status: 201 });
}
