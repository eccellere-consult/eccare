import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { generateQuotes } from '@/lib/quote-ai';
import { z } from 'zod';

const generateSchema = z.object({
  count: z.number().int().min(1).max(10).default(5),
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

  const status = req.nextUrl.searchParams.get('status');
  const where = status ? { status: status as 'pending' | 'approved' | 'rejected' } : {};

  const quotes = await prisma.dailyQuote.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ success: true, data: quotes });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const result = await generateQuotes(parsed.data.count);
  if (result.quotes.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_FAILED', message: result.error ?? 'Could not generate quotes.' } },
      { status: 502 },
    );
  }

  const created = [];
  for (const q of result.quotes) {
    const quote = await prisma.dailyQuote.create({
      data: { text: q.text, author: q.author, status: 'pending', generatedBy: result.provider },
    });
    created.push(quote);
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
