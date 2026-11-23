import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AI_CAPABILITIES, anthropicUsage, openAiUsage, trackAiCall, type AiCallHandle, type AiCapability } from './aiops.ts';

/**
 * Looks at a photo and drafts what a shop would write about it: one product (draftCatalogItem) or
 * a whole shelf of products (draftShelfItems). The shopkeeper always checks and edits the draft.
 * A price is only ever taken from a price tag or list that is printed in the photo; it is never
 * guessed. Same provider order and time limits as lib/prescription-ai.ts.
 */

export interface CatalogDraft {
  name: string;
  category: string;
  description: string;
}

export interface ShelfDraftItem extends CatalogDraft {
  /** Only when a price is clearly printed next to the product in the photo; otherwise null. */
  price: number | null;
}

export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

function categoryHint(existingCategories: string[]): string {
  return existingCategories.length
    ? `The shop already uses these categories: ${existingCategories.slice(0, 20).join(', ')}. Reuse one of them if it fits; otherwise suggest a short new one.`
    : 'Suggest a short category (one to three words).';
}

function buildPrompt(existingCategories: string[]): string {
  return `You help a small local shop in India list a product in its online catalogue. Look at the photo and write the listing.

Return ONLY a valid JSON object with exactly this shape:
{"name": "...", "category": "...", "description": "..."}

Rules:
- name: what a buyer would search for, in plain English, at most 60 characters. No brand names unless clearly readable on the product. No price, no emoji.
- category: ${categoryHint(existingCategories)}
- description: one or two plain sentences (at most 220 characters) about what the product is and what can be seen: material, colour, use. Do not invent sizes, quantities, brands, ingredients, offers or health claims. Do not mention price.
- If the photo does not show a product (a person, a blank wall, a document), return {"name":"","category":"","description":""}.`;
}

export const MAX_SHELF_ITEMS = 25;

function buildShelfPrompt(existingCategories: string[]): string {
  return `You help a small local shop in India fill its online catalogue quickly. The photo shows a shelf, a counter, a display or a printed price list with several products. List the distinct products you can clearly identify.

Return ONLY a valid JSON object with exactly this shape:
{"items": [{"name": "...", "category": "...", "description": "...", "price": null}]}

Rules:
- At most ${MAX_SHELF_ITEMS} items. One entry per distinct product; do not repeat the same product.
- Skip anything you cannot identify with confidence (blurry, hidden behind other items, cut off). Fewer correct items are better than many guesses.
- name: what a buyer would search for, in plain English, at most 60 characters. Include a size or variant (for example "500 ml" or "pack of 10") only if it is clearly readable on the product or its tag. No emoji.
- category: ${categoryHint(existingCategories)}
- description: one plain sentence (at most 160 characters) about what the product is. Do not invent brands, ingredients, quantities, offers or health claims.
- price: a number in rupees ONLY when a price is clearly printed on a tag, label or list next to that exact product. If there is no clearly matching price, use null. Never estimate a price.
- If the photo shows no products (a person, a blank wall), return {"items": []}.`;
}

const EMPTY: CatalogDraft = { name: '', category: '', description: '' };

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function parseDraft(text: string): CatalogDraft {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ...EMPTY };
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      name: clean(parsed.name, 60),
      category: clean(parsed.category, 60),
      description: clean(parsed.description, 240),
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Reads the model's shelf answer. Tolerant of extra text around the JSON; strict about what it keeps:
 *  a name is required, a price must be a sensible positive number or it becomes null, duplicates and
 *  anything past MAX_SHELF_ITEMS are dropped. */
export function parseShelf(text: string): ShelfDraftItem[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let rows: unknown;
  try {
    rows = (JSON.parse(match[0]) as { items?: unknown }).items;
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const out: ShelfDraftItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = clean(r.name, 60);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // A string such as "Rs. 1,299.50" is accepted; anything without a clear number stays null.
    const priceText = typeof r.price === 'string' ? r.price.match(/\d[\d,]*(?:\.\d+)?/)?.[0] : undefined;
    const rawPrice = typeof r.price === 'number' ? r.price : priceText ? Number(priceText.replace(/,/g, '')) : NaN;
    const price = Number.isFinite(rawPrice) && rawPrice > 0 && rawPrice <= 1_000_000 ? Math.round(rawPrice * 100) / 100 : null;
    out.push({ name, category: clean(r.category, 60), description: clean(r.description, 200), price });
    if (out.length >= MAX_SHELF_ITEMS) break;
  }
  return out;
}

async function askClaude(b64: string, mediaType: MediaType, prompt: string, maxTokens: number, call?: AiCallHandle): Promise<string> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: Math.max(maxTokens, 1024),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  call?.setUsage(anthropicUsage(message)); // technical numbers only, for the AI Control Tower
  const block = message.content.find((b) => b.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

async function askOpenAiCompatible(client: OpenAI, model: string, b64: string, mediaType: MediaType, prompt: string, maxTokens: number, call?: AiCallHandle): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          // "high" detail for shelves: small print on tags has to be readable.
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${b64}`, detail: maxTokens > 600 ? 'high' : 'low' } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  call?.setUsage(openAiUsage(response)); // technical numbers only, for the AI Control Tower
  return response.choices[0]?.message?.content ?? '';
}

type Ask = (b64: string, mediaType: MediaType, prompt: string, maxTokens: number, call: AiCallHandle) => Promise<string>;

const PROVIDERS: { name: string; report: { provider: string; model: string }; available: () => boolean; run: Ask }[] = [
  { name: 'anthropic', report: { provider: 'anthropic', model: 'claude-sonnet-5' }, available: () => !!process.env.ANTHROPIC_API_KEY, run: askClaude },
  {
    name: 'openai',
    report: { provider: 'openai', model: 'gpt-4o' },
    available: () => !!process.env.OPENAI_API_KEY,
    run: (b64, mt, prompt, max, call) => askOpenAiCompatible(new OpenAI(), 'gpt-4o', b64, mt, prompt, max, call),
  },
  {
    name: 'grok',
    report: { provider: 'xai', model: 'grok-4.5' },
    available: () => !!process.env.XAI_API_KEY,
    run: (b64, mt, prompt, max, call) =>
      askOpenAiCompatible(new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' }), 'grok-4.5', b64, mt, prompt, max, call),
  },
];

const PER_PROVIDER_MS = 25_000;
const TOTAL_BUDGET_MS = 40_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function isCatalogAiConfigured(): boolean {
  return PROVIDERS.some((p) => p.available());
}

/** Runs the prompt through the first provider that answers; null when none is set up or all failed. */
export async function askFirstAvailable(
  b64: string,
  mediaType: MediaType,
  prompt: string,
  maxTokens: number,
  /** What this call is for, as named in the AI Control Tower. */
  capability: AiCapability = AI_CAPABILITIES.catalogItemDraft,
): Promise<string | null> {
  const startedAt = Date.now();
  for (const provider of PROVIDERS) {
    if (!provider.available()) continue;
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 5_000) break;
    try {
      // The report wraps the time limit too, so a call the app gave up on is reported as a timeout.
      return await trackAiCall({ ...capability, ...provider.report }, (call) =>
        withTimeout(provider.run(b64, mediaType, prompt, maxTokens, call), Math.min(PER_PROVIDER_MS, remaining), provider.name),
      );
    } catch (err) {
      console.warn(`[catalog-ai] ${provider.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

/** Returns a draft for one product, or null when no AI is set up or every provider failed (the
 *  shopkeeper then simply types the details; nothing breaks). */
export async function draftCatalogItem(
  imageBase64: string,
  mediaType: MediaType,
  existingCategories: string[],
): Promise<CatalogDraft | null> {
  const text = await askFirstAvailable(imageBase64, mediaType, buildPrompt(existingCategories), 400);
  return text === null ? null : parseDraft(text);
}

/** Returns the products found on a shelf photo, or null when no AI is set up or every provider failed. */
export async function draftShelfItems(
  imageBase64: string,
  mediaType: MediaType,
  existingCategories: string[],
): Promise<ShelfDraftItem[] | null> {
  const text = await askFirstAvailable(imageBase64, mediaType, buildShelfPrompt(existingCategories), 2400, AI_CAPABILITIES.catalogShelfDraft);
  return text === null ? null : parseShelf(text);
}
