import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface GeneratedQuote {
  text: string;
  author: string | null;
}

function buildPrompt(count: number): string {
  return `You write short daily motivational quotes for a care app used by elderly people (65+) in India.

Generate exactly ${count} original, warm, encouraging quotes suitable for an elder to read first thing in the morning. Each should be one or two sentences, plain and easy to read aloud. Avoid religious references, medical advice, and anything about illness or decline — focus on gratitude, connection, small joys, and staying positive.

Return ONLY a valid JSON array with this exact shape, nothing else:
[
  { "text": "...", "author": "Name" or null }
]

Rules:
- "author" is null unless you are quoting a real, well-known person accurately — otherwise write an original quote and leave author null.
- Keep each quote under 30 words.
- Do not repeat the same idea across the ${count} quotes.`;
}

function parseQuotes(text: string): GeneratedQuote[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is { text: unknown; author?: unknown } => typeof q === 'object' && q !== null)
      .map((q) => ({
        text: typeof q.text === 'string' ? q.text.trim() : '',
        author: typeof q.author === 'string' && q.author.trim() ? q.author.trim() : null,
      }))
      .filter((q) => q.text.length > 0);
  } catch {
    return [];
  }
}

async function generateWithAnthropic(count: number): Promise<GeneratedQuote[]> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(count) }],
  });
  // Sonnet 5 runs adaptive thinking by default, which puts a thinking block
  // before the text block — content[0] is not reliably the text block.
  const textBlock = message.content.find((block) => block.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '';
  return parseQuotes(text);
}

async function generateWithOpenAI(count: number): Promise<GeneratedQuote[]> {
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(count) }],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseQuotes(text);
}

async function generateWithGrok(count: number): Promise<GeneratedQuote[]> {
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });
  const response = await client.chat.completions.create({
    // grok-2-1212 was retired; xAI's current flagship for chat/agentic
    // workloads is grok-4.5 (as of 2026-08) — verify this is still current
    // if it starts 400ing again, xAI's model names churn faster than Anthropic's.
    model: 'grok-4.5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(count) }],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseQuotes(text);
}

type Provider = { name: string; available: () => boolean; generate: (count: number) => Promise<GeneratedQuote[]> };

const PROVIDERS: Provider[] = [
  { name: 'anthropic', available: () => !!process.env.ANTHROPIC_API_KEY, generate: generateWithAnthropic },
  { name: 'openai', available: () => !!process.env.OPENAI_API_KEY, generate: generateWithOpenAI },
  { name: 'grok', available: () => !!process.env.XAI_API_KEY, generate: generateWithGrok },
];

export async function generateQuotes(count: number): Promise<{ quotes: GeneratedQuote[]; provider?: string; error?: string }> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.available()) continue;
    try {
      const quotes = await provider.generate(count);
      if (quotes.length > 0) return { quotes, provider: provider.name };
      errors.push(`${provider.name}: returned no usable quotes`);
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    quotes: [],
    error: errors.length > 0
      ? `Quote generation failed across all providers. Errors: ${errors.join('; ')}`
      : 'No AI provider configured.',
  };
}

export function isConfigured(): boolean {
  return PROVIDERS.some((p) => p.available());
}

export function configuredProviders(): string[] {
  return PROVIDERS.filter((p) => p.available()).map((p) => p.name);
}
