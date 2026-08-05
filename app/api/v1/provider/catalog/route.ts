import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  price: z.number().positive().max(1_000_000),
  category: z.string().max(60).optional(),
  inStock: z.boolean().optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

async function requireOwnProvider(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'provider') return { error: fail('FORBIDDEN', 'Providers only.', 403) };

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return { error: fail('NOT_FOUND', 'Provider profile not found.', 404) };

  return { auth, provider };
}

export async function GET(req: NextRequest) {
  const guard = await requireOwnProvider(req);
  if (guard.error) return guard.error;

  const items = await prisma.catalogItem.findMany({
    where: { providerId: guard.provider.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnProvider(req);
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please enter a name and a valid price.', 400);

  const item = await prisma.catalogItem.create({
    data: { providerId: guard.provider.id, ...parsed.data },
  });

  return NextResponse.json({ success: true, data: item }, { status: 201 });
}
