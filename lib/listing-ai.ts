import type { MediaType } from '@/lib/catalog-ai';

/**
 * Looks at a photo of something a neighbour wants to sell, rent out, lend or find (Community →
 * Buy, sell, rent & lend) or at a house or room for rent (Rentals), and drafts a title and a short
 * description. The person always checks and edits the draft. It never guesses a price, a rent, an
 * address or a claim such as "senior-friendly" - only what can be seen in the picture.
 * Uses the same AI providers, order and time limits as the provider catalogue (lib/catalog-ai.ts).
 */

export type ListingDraftKind = 'marketplace' | 'rental';
export type MarketplaceMode = 'sell' | 'rent' | 'lend' | 'wanted';

export interface ListingDraft {
  title: string;
  description: string;
}

const MODE_HINT: Record<MarketplaceMode, string> = {
  sell: 'The person wants to SELL this item.',
  rent: 'The person wants to RENT OUT this item.',
  lend: 'The person wants to LEND this item to neighbours for free.',
  wanted: 'The person is LOOKING FOR an item like the one in the photo.',
};

export function buildListingPrompt(kind: ListingDraftKind, mode?: MarketplaceMode): string {
  if (kind === 'rental') {
    return `You help a person in India write a rental listing for an independent house or a room. Look at the photo and write the listing.

Return ONLY a valid JSON object with exactly this shape:
{"title": "...", "description": "..."}

Rules:
- title: at most 70 characters, plain English, what a tenant would search for (for example "Bright ground-floor room with a window"). No price, no emoji.
- description: one to three plain sentences (at most 240 characters) about what can be SEEN: the type of room or house, light, floor, furniture, view. Do not invent the size, number of rooms, location, rent, deposit, rules, or facilities. Do not say it is safe, accessible or suitable for senior citizens, and do not mention ramps, grab bars or steps unless one is clearly visible.
- If the photo does not show a house, a room or a part of one (a person, a document, a blank wall), return {"title":"","description":""}.`;
  }
  const hint = MODE_HINT[mode ?? 'sell'];
  return `You help neighbours in a residential community in India post a listing to sell, rent, lend or ask for an item. Look at the photo and write the listing. ${hint}

Return ONLY a valid JSON object with exactly this shape:
{"title": "...", "description": "..."}

Rules:
- title: what a neighbour would search for, in plain English, at most 60 characters (for example "Foldable wheelchair"). No brand unless clearly readable on the item. No price, no emoji.
- description: one or two plain sentences (at most 200 characters) about what the item is and what can be seen: colour, material, and condition only if it is clearly visible. Do not invent age, size, brand, working condition, warranty, or a price.
- If the photo does not show an item (a person, a blank wall, a document), return {"title":"","description":""}.`;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function parseListingDraft(text: string, kind: ListingDraftKind): ListingDraft {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { title: '', description: '' };
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      title: clean(parsed.title, kind === 'rental' ? 70 : 60),
      description: clean(parsed.description, kind === 'rental' ? 240 : 200),
    };
  } catch {
    return { title: '', description: '' };
  }
}

/** A draft for one listing photo, or null when no AI is set up or every provider failed (the person
 *  then simply types the details; nothing breaks). */
export async function draftListing(
  imageBase64: string,
  mediaType: MediaType,
  kind: ListingDraftKind,
  mode?: MarketplaceMode,
): Promise<ListingDraft | null> {
  // Loaded when needed, so the pure parts above can be tested on their own without the AI libraries.
  const { askFirstAvailable } = await import('@/lib/catalog-ai');
  const { AI_CAPABILITIES } = await import('@/lib/aiops');
  const text = await askFirstAvailable(imageBase64, mediaType, buildListingPrompt(kind, mode), 400, AI_CAPABILITIES.listingPhotoDraft);
  return text === null ? null : parseListingDraft(text, kind);
}
