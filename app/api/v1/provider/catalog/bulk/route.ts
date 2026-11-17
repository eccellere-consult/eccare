import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const MAX_ITEMS = 40;

const schema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).optional(),
        price: z.number().positive().max(1_000_000),
        category: z.string().trim().max(60).optional(),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Saves several catalogue items in one go (the shelf-photo flow, after the shop has checked each row).
 *  An item whose name is already in the catalogue (or repeated in this list) is skipped, not doubled. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail('INVALID_INPUT', `Every item needs a name and a price, and you can add up to ${MAX_ITEMS} at a time.`, 400);
  }

  const existing = await prisma.catalogItem.findMany({ where: { providerId: provider.id }, select: { name: true } });
  const taken = new Set(existing.map((e) => e.name.trim().toLowerCase()));

  const toCreate: typeof parsed.data.items = [];
  const skipped: string[] = [];
  for (const item of parsed.data.items) {
    const key = item.name.toLowerCase();
    if (taken.has(key)) {
      skipped.push(item.name);
      continue;
    }
    taken.add(key);
    toCreate.push(item);
  }

  if (toCreate.length > 0) {
    await prisma.catalogItem.createMany({
      data: toCreate.map((i) => ({
        providerId: provider.id,
        name: i.name,
        price: i.price,
        description: i.description || null,
        category: i.category || null,
      })),
    });
  }

  return NextResponse.json({ success: true, data: { created: toCreate.length, skipped } }, { status: 201 });
}
