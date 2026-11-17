import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Looks at a photo of one product and drafts what a shop would write about it. The shopkeeper
 * always checks and edits the draft, and always types the price themselves: a price is never
 * guessed. Same provider order and time limits as lib/prescription-ai.ts.
 */

export interface CatalogDraft {
  name: string;
  category: string;
  description: string;
}

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

function buildPrompt(existingCategories: string[]): string {
  const cats = existingCategories.length
    ? `The shop already uses these categories: ${existingCategories.slice(0, 20).join(', ')}. Reuse one of them if it fits; otherwise suggest a short new one.`
    : 'Suggest a short category (one to three words).';
  return `You help a small local shop in India list a product in its online catalogue. Look at the photo and write the listing.

Return ONLY a valid JSON object with exactly this shape:
{"name": "...", "category": "...", "description": "..."}

Rules:
- name: what a buyer would search for, in plain English, at most 60 characters. No brand names unless clearly readable on the product. No price, no emoji.
- category: ${cats}
- description: one or two plain sentences (at most 220 characters) about what the product is and what can be seen: material, colour, use. Do not invent sizes, quantities, brands, ingredients, offers or health claims. Do not mention price.
- If the photo does not show a product (a person, a blank wall, a document), return {"name":"","category":"","description":""}.`;
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

async function withClaude(b64: string, mediaType: MediaType, cats: string[]): Promise<CatalogDraft> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: buildPrompt(cats) },
        ],
      },
    ],
  });
  const block = message.content.find((b) => b.type === 'text');
  return parseDraft(block?.type === 'text' ? block.text : '');
}

async function withOpenAI(b64: string, mediaType: MediaType, cats: string[]): Promise<CatalogDraft> {
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${b64}`, detail: 'low' } },
          { type: 'text', text: buildPrompt(cats) },
        ],
      },
    ],
  });
  return parseDraft(response.choices[0]?.message?.content ?? '');
}

async function withGrok(b64: string, mediaType: MediaType, cats: string[]): Promise<CatalogDraft> {
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  const response = await client.chat.completions.create({
    model: 'grok-4.5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${b64}`, detail: 'low' } },
          { type: 'text', text: buildPrompt(cats) },
        ],
      },
    ],
  });
  return parseDraft(response.choices[0]?.message?.content ?? '');
}

const PROVIDERS: { name: string; available: () => boolean; run: typeof withClaude }[] = [
  { name: 'anthropic', available: () => !!process.env.ANTHROPIC_API_KEY, run: withClaude },
  { name: 'openai', available: () => !!process.env.OPENAI_API_KEY, run: withOpenAI },
  { name: 'grok', available: () => !!process.env.XAI_API_KEY, run: withGrok },
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

/** Returns a draft, or null when no AI is set up or every provider failed (the shopkeeper then
 *  simply types the details; nothing breaks). */
export async function draftCatalogItem(
  imageBase64: string,
  mediaType: MediaType,
  existingCategories: string[],
): Promise<CatalogDraft | null> {
  const startedAt = Date.now();
  for (const provider of PROVIDERS) {
    if (!provider.available()) continue;
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 5_000) break;
    try {
      return await withTimeout(
        provider.run(imageBase64, mediaType, existingCategories),
        Math.min(PER_PROVIDER_MS, remaining),
        provider.name,
      );
    } catch (err) {
      console.warn(`[catalog-ai] ${provider.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}
