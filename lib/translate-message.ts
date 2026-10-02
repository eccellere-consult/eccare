import Anthropic from '@anthropic-ai/sdk';

export const TRANSLATION_LANGUAGE_NAMES: Record<string, string> = {
  hi: 'Hindi',
  kn: 'Kannada',
  ml: 'Malayalam',
};

const SYSTEM_PROMPT = `You translate short WhatsApp messages for an elder-care app used in India.
Rules:
- Translate into the requested language, in simple, warm, everyday wording an elderly person would understand.
- Keep every {{placeholder}} EXACTLY as written (same spelling, same double braces) — never translate or remove them.
- Keep line breaks, blank lines, emoji, numbers, URLs, and the ₹ sign exactly as they are.
- Keep brand and product names in English: EC, WhatsApp, SOS, "Just Easy.".
- Do not add, remove, or explain anything. Reply with the translated message only — no quotes, no notes.`;

const placeholdersOf = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

async function translateOne(english: string, language: string): Promise<string> {
  const anthropic = new Anthropic();
  const name = TRANSLATION_LANGUAGE_NAMES[language];
  const wanted = placeholdersOf(english);

  // One retry: the only thing worth retrying for is a model that dropped or
  // altered a {{placeholder}}, which would silently break the message.
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Translate into ${name}:\n\n${english}` }],
    });
    const block = message.content.find((b) => b.type === 'text');
    const text = block?.type === 'text' ? block.text.trim() : '';
    if (text && placeholdersOf(text) === wanted) return text;
  }
  throw new Error(`Could not translate to ${name} without changing the {{placeholders}}.`);
}

export function isTranslationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Translates an English message into each requested language in parallel.
 *  A language that fails (API error, or a translation that mangled a
 *  placeholder twice) is reported in `failed` rather than failing the rest. */
export async function translateMessage(
  english: string,
  languages: string[],
): Promise<{ translations: Record<string, string>; failed: string[] }> {
  const targets = languages.filter((l) => l in TRANSLATION_LANGUAGE_NAMES);
  const results = await Promise.allSettled(targets.map((l) => translateOne(english, l)));

  const translations: Record<string, string> = {};
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') translations[targets[i]] = r.value;
    else {
      console.error(`[translate] ${targets[i]} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
      failed.push(targets[i]);
    }
  });
  return { translations, failed };
}
