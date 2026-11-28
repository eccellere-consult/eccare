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
 *  A new name is added. A name already in the catalogue is updated, not doubled: its price becomes
 *  the one the shop just confirmed, and an empty description or category is filled in. A name
 *  repeated inside this list is skipped. The answer lists each saved item (`saved`, with its place
 *  in the list sent) so the page can then attach each product's picture. */
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

  const existing = await prisma.catalogItem.findMany({
    where: { providerId: provider.id },
    select: { id: true, name: true, description: true, category: true, imagePath: true },
  });
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));

  const seen = new Set<string>();
  const skipped: string[] = [];
  const saved: { index: number; id: string; isNew: boolean; hasPhoto: boolean }[] = [];
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, item] of parsed.data.items.entries()) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        skipped.push(item.name);
        continue;
      }
      seen.add(key);
      const match = byName.get(key);
      if (match) {
        await tx.catalogItem.update({
          where: { id: match.id },
          data: {
            price: item.price,
            description: match.description?.trim() ? undefined : item.description || undefined,
            category: match.category?.trim() ? undefined : item.category || undefined,
          },
        });
        updated += 1;
        saved.push({ index, id: match.id, isNew: false, hasPhoto: !!match.imagePath });
      } else {
        const row = await tx.catalogItem.create({
          data: {
            providerId: provider.id,
            name: item.name,
            price: item.price,
            description: item.description || null,
            category: item.category || null,
          },
          select: { id: true },
        });
        created += 1;
        saved.push({ index, id: row.id, isNew: true, hasPhoto: false });
      }
    }
  });

  return NextResponse.json({ success: true, data: { created, updated, skipped, saved } }, { status: 201 });
}
