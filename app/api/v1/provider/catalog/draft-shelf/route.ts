import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { draftShelfItems, isCatalogAiConfigured } from '@/lib/catalog-ai';

const MAX_SIZE = 6 * 1024 * 1024; // the browser shrinks photos first; this is only a ceiling
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
type Allowed = (typeof ALLOWED)[number];

// A shelf photo costs more AI money than one item, so a shop gets 10 an hour.
const LIMIT_PER_HOUR = 10;
const recent = new Map<string, number[]>();

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Looks at a photo of a shelf, counter or price list and drafts a list of products: name, category,
 *  description, where it sits in the photo, and a price only when one is printed in the photo. Nothing is saved here: the shop
 *  checks the list and saves it with POST /provider/catalog/bulk. If AI is unavailable the answer is
 *  `items: null` and the shop adds items one by one as before. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const now = Date.now();
  const hits = (recent.get(provider.id) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= LIMIT_PER_HOUR) {
    return fail('RATE_LIMITED', 'You have used the shelf photo helper a lot this hour. Please try again later, or add items one by one.', 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the photo.', 400);
  }
  const file = form.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No photo sent.', 400);
  if (!ALLOWED.includes(file.type as Allowed)) return fail('VALIDATION', 'Only JPEG, PNG and WebP photos work.', 400);
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'That photo is too large.', 400);

  if (!isCatalogAiConfigured()) {
    return NextResponse.json({ success: true, data: { items: null, reason: 'The photo helper is not set up yet. Please add items one by one.' } });
  }

  const categories = await prisma.catalogItem.findMany({
    where: { providerId: provider.id, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    take: 30,
  });

  hits.push(now);
  recent.set(provider.id, hits);

  const bytes = Buffer.from(await file.arrayBuffer()).toString('base64');
  const items = await draftShelfItems(
    bytes,
    file.type as Allowed,
    categories.map((c) => c.category as string),
  );

  if (items === null) {
    return NextResponse.json({ success: true, data: { items: null, reason: 'The photo helper could not read this picture. Please try a clearer photo, or add items one by one.' } });
  }
  if (items.length === 0) {
    return NextResponse.json({ success: true, data: { items: [], reason: 'No products found in this photo. Try standing closer, in good light, with the products facing you.' } });
  }

  // Tell the shop which of these it already sells, with today's price, so it does not type a price
  // again and can see that saving will update the item, not add a second one.
  const current = await prisma.catalogItem.findMany({ where: { providerId: provider.id }, select: { name: true, price: true, imagePath: true } });
  const byName = new Map(current.map((c) => [c.name.trim().toLowerCase(), c]));
  const withExisting = items.map((it) => {
    const match = byName.get(it.name.toLowerCase());
    return { ...it, existing: match ? { price: Number(match.price), hasPhoto: !!match.imagePath } : null };
  });
  return NextResponse.json({ success: true, data: { items: withExisting, reason: null } });
}
