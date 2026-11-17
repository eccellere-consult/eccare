import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { draftCatalogItem, isCatalogAiConfigured } from '@/lib/catalog-ai';

const MAX_SIZE = 6 * 1024 * 1024; // the browser shrinks photos first; this is only a ceiling
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
type Allowed = (typeof ALLOWED)[number];

// Every draft costs a little AI money, so one shop can ask 30 times an hour, no more.
const LIMIT_PER_HOUR = 30;
const recent = new Map<string, number[]>();

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Looks at a product photo and drafts its name, category and description. Never a price. If AI is
 *  not available or cannot read the photo, the answer is `draft: null` and the shop types the details. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const now = Date.now();
  const hits = (recent.get(provider.id) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= LIMIT_PER_HOUR) {
    return fail('RATE_LIMITED', 'You have used the photo helper a lot this hour. Please type the details, or try again later.', 429);
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

  if (!isCatalogAiConfigured()) return NextResponse.json({ success: true, data: { draft: null, reason: 'AI is not set up.' } });

  const categories = await prisma.catalogItem.findMany({
    where: { providerId: provider.id, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    take: 30,
  });

  hits.push(now);
  recent.set(provider.id, hits);

  const bytes = Buffer.from(await file.arrayBuffer()).toString('base64');
  const draft = await draftCatalogItem(
    bytes,
    file.type as Allowed,
    categories.map((c) => c.category as string),
  );

  const usable = draft && (draft.name || draft.description) ? draft : null;
  return NextResponse.json({
    success: true,
    data: { draft: usable, reason: usable ? null : 'The photo helper could not read this picture. Please type the details.' },
  });
}
