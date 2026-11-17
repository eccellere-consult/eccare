import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isCatalogAiConfigured } from '@/lib/catalog-ai';
import { draftListing, type ListingDraftKind, type MarketplaceMode } from '@/lib/listing-ai';
import { sniffUploadType } from '@/lib/upload-guard';

const MAX_SIZE = 6 * 1024 * 1024; // the browser shrinks photos first; this is only a ceiling

// Every draft costs a little AI money, so one person can ask 30 times an hour, no more.
const LIMIT_PER_HOUR = 30;
const recent = new Map<string, number[]>();

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Looks at a photo for a Buy/Sell/Rent/Lend listing or a house rental and drafts its title and
 *  description. Never a price. If AI is not available or cannot read the photo, the answer is
 *  `draft: null` and the person types the details. */
export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err) {
    console.error('Listing photo draft crashed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: true, data: { draft: null, reason: 'The photo helper is not available. Please type the details.' } });
  }
}

async function handle(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const now = Date.now();
  const hits = (recent.get(auth.userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= LIMIT_PER_HOUR) {
    return fail('RATE_LIMITED', 'You have used the photo helper a lot this hour. Please type the details, or try again later.', 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the photo.', 400);
  }
  const kindRaw = String(form.get('kind') ?? 'marketplace');
  const kind: ListingDraftKind = kindRaw === 'rental' ? 'rental' : 'marketplace';
  const modeRaw = String(form.get('mode') ?? 'sell');
  const mode: MarketplaceMode = (['sell', 'rent', 'lend', 'wanted'] as const).find((m) => m === modeRaw) ?? 'sell';

  const file = form.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No photo sent.', 400);
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'That photo is too large.', 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  // Judged by the real picture bytes, not the label a phone camera gave the file.
  const mediaType = sniffUploadType(buffer);
  if (!mediaType) return fail('VALIDATION', 'Only JPEG and PNG photos work.', 400);

  if (!isCatalogAiConfigured()) {
    return NextResponse.json({ success: true, data: { draft: null, reason: 'The photo helper is not set up. Please type the details.' } });
  }

  hits.push(now);
  recent.set(auth.userId, hits);

  const draft = await draftListing(buffer.toString('base64'), mediaType, kind, mode);
  const usable = draft && (draft.title || draft.description) ? draft : null;
  return NextResponse.json({
    success: true,
    data: { draft: usable, reason: usable ? null : 'The photo helper could not read this picture. Please type the details.' },
  });
}
