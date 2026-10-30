// The health-bulletin agent: finds trustworthy guidance on one health topic, writes a short plain-language
// bulletin from it, runs the safety rules, and saves the result for an admin to read. It never publishes.
//
// The model searches the web through Anthropic's server-side web-search tool, restricted to the domains in
// lib/health-sources.ts. It is called over plain HTTP rather than through @anthropic-ai/sdk because the
// installed SDK (0.39) predates that tool; the request and response shapes are documented at
// https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool (web search must be switched
// on for the organisation in the Anthropic Console).

import { prisma } from '@/lib/db';
import { HEALTH_TOPICS, TRUSTED_SOURCES, publisherFor, topicById, type HealthTopic } from './health-sources';
import {
  checkFields,
  composeNotice,
  composeWhatsApp,
  extractJson,
  hasBlock,
  parseFields,
  type BulletinFields,
  type Flag,
} from './health-bulletin-rules';

const API_URL = 'https://api.anthropic.com/v1/messages';
export const healthAgentModel = () => process.env.HEALTH_AGENT_MODEL || 'claude-sonnet-5-5';

/** Do not write about a topic again within this many days (unless an admin asks for it). */
export const MIN_DAYS_BETWEEN_SAME_TOPIC = 21;
/** The scheduled run stops adding drafts once this many are waiting for an admin. */
export const MAX_PENDING_DRAFTS = 6;

/** The agent's own key if one is set, so its spending cap is separate from the voice assistant's; otherwise the shared one. */
export const healthAgentApiKey = () => process.env.HEALTH_AGENT_API_KEY || process.env.ANTHROPIC_API_KEY || '';

/** Turns an Anthropic error response into a sentence an admin can act on. Exported for testing. */
export function describeApiError(status: number, bodyText: string): string {
  let type = '';
  let message = '';
  try {
    const parsed = JSON.parse(bodyText) as { error?: { type?: string; message?: string } };
    type = parsed.error?.type ?? '';
    message = parsed.error?.message ?? '';
  } catch {
    message = bodyText.slice(0, 200);
  }
  const lower = message.toLowerCase();

  if (/usage limit|spend limit|spending limit/.test(lower)) {
    const when = message.match(/You will regain access[^.]*\./i)?.[0];
    return `The Anthropic account has reached its usage limit. ${when ? `${when} ` : ''}To use it sooner, raise the limit in the Anthropic console.`;
  }
  if (/credit balance/.test(lower)) return 'The Anthropic account is out of credit. Add credit in the Anthropic console.';
  if (/web.?search/.test(lower)) {
    return `Web search is not available for this Anthropic account. Switch it on in the Anthropic console, then try again. (Anthropic said: ${message})`;
  }
  if (status === 404 || (type === 'not_found_error' && /model/.test(lower))) {
    return `The model "${healthAgentModel()}" was not found for this key. Set HEALTH_AGENT_MODEL to a model your account can use. (Anthropic said: ${message})`;
  }
  if (status === 401 || type === 'authentication_error') {
    return 'The Anthropic API key was not accepted. Check HEALTH_AGENT_API_KEY (or ANTHROPIC_API_KEY) on the server.';
  }
  if (status === 403 || type === 'permission_error') return 'The Anthropic API key is not allowed to do this (permission denied).';
  if (status === 429 || type === 'rate_limit_error') return 'Anthropic is limiting how fast requests can be sent. Please try again in a minute.';
  if (status === 529 || type === 'overloaded_error') return 'Anthropic is busy right now. Please try again shortly.';
  return `Anthropic API answered ${status}: ${message || 'no details given'}`;
}

export class HealthAgentError extends Error {
  constructor(public code: 'NOT_CONFIGURED' | 'MODEL_ERROR', message: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are the health-information editor for EC, an app used by older adults (65+) in India and by their families. You turn trustworthy public health guidance into short, plain-language bulletins.

HOW TO WORK
1. Use the web_search tool (it only returns pages from trusted health organisations) to find current guidance on the topic. Prefer guidance for older adults, and for India where it exists.
2. Write ONLY from what those pages say. Never add facts, numbers, treatments or advice from memory. If the pages do not support a point, leave it out.
3. Cite every page you actually used, with its exact URL as returned by the search.

STYLE
- Reading level of a 12-year-old. Short sentences (under 20 words). Everyday words; explain any medical term in brackets the first time.
- Warm, calm and respectful. Never frightening. No jargon, no emojis, no hashtags.
- Practical: what a person can do this week.

SAFETY RULES — never break these
- General information only. Do not diagnose. Do not tell anyone to start, stop, change or skip any medicine, eye drop, injection or treatment, and never give a dose or an amount of any medicine.
- Never claim a cure, a guarantee or a quick fix. No home remedies or supplements unless the sources clearly recommend them.
- Never suggest this replaces a doctor. In "seeDoctor" always say who to see (for example an eye doctor, a family doctor or a pharmacist) and when.
- List warning signs only if the sources themselves name them.

OUTPUT
Return ONLY one JSON object, with no markdown fences and no other text:
{
  "title": "max 70 characters",
  "summary": "2 to 3 short sentences, max 380 characters",
  "tips": ["3 to 5 items, each starting with a verb, each max 130 characters"],
  "warningSigns": ["0 to 4 items, each max 110 characters; an empty list if the sources name none"],
  "seeDoctor": "one sentence, max 160 characters",
  "sources": [{"title": "page title", "url": "https://... exactly as returned by the search"}]
}`;

const userPrompt = (topic: HealthTopic) =>
  `Topic: ${topic.label}\nGuidance for the search: ${topic.hint}\nToday's date: ${new Date().toISOString().slice(0, 10)}\n\nSearch for current, reliable guidance and write the bulletin.`;

// ── Talking to the model ──────────────────────────────────────────────────────

export interface ModelAnswer {
  /** The model's final reply (it should be the JSON object). */
  text: string;
  /** Every page the search returned — the only URLs a bulletin may cite. */
  searchedUrls: string[];
}
export type ModelCaller = (topic: HealthTopic) => Promise<ModelAnswer>;

/** Pulls the final text and the searched URLs out of one API response; exported for testing. */
export function readResponseContent(content: unknown[], into: { text: string; urls: Set<string> }) {
  for (const raw of content) {
    const block = raw as { type?: string; text?: string; content?: unknown };
    if (block.type === 'server_tool_use' || block.type === 'web_search_tool_result') {
      into.text = ''; // anything said before or between searches is working-out, not the answer
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content as { type?: string; url?: string }[]) {
          if (r?.type === 'web_search_result' && r.url) into.urls.add(r.url);
        }
      }
    } else if (block.type === 'text' && typeof block.text === 'string') {
      into.text += block.text;
    }
  }
}

export const callModelWithSearch: ModelCaller = async (topic) => {
  const apiKey = healthAgentApiKey();
  if (!apiKey) throw new HealthAgentError('NOT_CONFIGURED', 'Neither HEALTH_AGENT_API_KEY nor ANTHROPIC_API_KEY is set.');

  const messages: unknown[] = [{ role: 'user', content: userPrompt(topic) }];
  const state = { text: '', urls: new Set<string>() };

  // A long search can pause the turn (stop_reason "pause_turn"); sending it back lets it carry on.
  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: healthAgentModel(),
        max_tokens: 3000,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4, allowed_domains: Object.keys(TRUSTED_SOURCES) }],
        messages,
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) throw new HealthAgentError('MODEL_ERROR', describeApiError(res.status, await res.text()));

    const data = (await res.json()) as { content?: unknown[]; stop_reason?: string };
    readResponseContent(data.content ?? [], state);
    if (data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }
  return { text: state.text, searchedUrls: [...state.urls] };
};

// ── One bulletin ──────────────────────────────────────────────────────────────

export interface DraftResult {
  fields: BulletinFields | null;
  flags: Flag[];
  searchedUrls: string[];
}

/** Asks the model for a bulletin on `topic` and checks it. Does not touch the database. */
export async function draftBulletin(topic: HealthTopic, call: ModelCaller = callModelWithSearch): Promise<DraftResult> {
  const answer = await call(topic);
  const fields = parseFields(extractJson(answer.text));
  if (!fields) {
    return {
      fields: null,
      searchedUrls: answer.searchedUrls,
      flags: [{ level: 'block', code: 'unreadable', message: 'The answer was not a complete bulletin and could not be used.' }],
    };
  }
  return { fields, flags: checkFields(fields, answer.searchedUrls), searchedUrls: answer.searchedUrls };
}

// ── Running the agent ─────────────────────────────────────────────────────────

export interface RunOptions {
  /** Specific topics to write about; otherwise the ones that have gone longest without a bulletin. */
  topicIds?: string[];
  count?: number;
  /** Ignore the "same topic recently" gap and the "too many drafts waiting" cap (a manual request). */
  force?: boolean;
}

export type RunResult =
  | { topic: string; outcome: 'draft' | 'auto-rejected'; id: string; flags: Flag[] }
  | { topic: string; outcome: 'unusable' | 'error'; reason: string }
  | { topic?: undefined; outcome: 'skipped'; reason: string };

/** The topics that have gone longest without a (non-rejected) bulletin, oldest first. */
export async function pickTopics(count: number, respectGap: boolean): Promise<HealthTopic[]> {
  const latest = await prisma.healthBulletin.groupBy({
    by: ['topic'],
    where: { status: { not: 'rejected' } },
    _max: { generatedAt: true },
  });
  const last = new Map(latest.map((l) => [l.topic, l._max.generatedAt?.getTime() ?? 0]));
  const cutoff = Date.now() - MIN_DAYS_BETWEEN_SAME_TOPIC * 86_400_000;
  return HEALTH_TOPICS.filter((t) => !respectGap || (last.get(t.id) ?? 0) < cutoff)
    .sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0))
    .slice(0, count);
}

export async function runHealthAgent(options: RunOptions = {}, call: ModelCaller = callModelWithSearch): Promise<RunResult[]> {
  const { topicIds, count = 1, force = false } = options;

  if (!force) {
    const waiting = await prisma.healthBulletin.count({ where: { status: 'draft' } });
    if (waiting >= MAX_PENDING_DRAFTS) {
      return [{ outcome: 'skipped', reason: `${waiting} drafts are already waiting for review; clear some before writing more.` }];
    }
  }

  const topics = topicIds?.length
    ? topicIds.map(topicById).filter((t): t is HealthTopic => !!t)
    : await pickTopics(count, !force);
  if (!topics.length) return [{ outcome: 'skipped', reason: 'No topic is due: each has had a bulletin recently.' }];

  const results: RunResult[] = [];
  for (const topic of topics) {
    try {
      const { fields, flags } = await draftBulletin(topic, call);
      if (!fields) {
        results.push({ topic: topic.id, outcome: 'unusable', reason: flags[0]?.message ?? 'Unreadable answer.' });
        continue;
      }
      const rejected = hasBlock(flags);
      const saved = await prisma.healthBulletin.create({
        data: {
          topic: topic.id,
          title: fields.title,
          body: composeNotice(fields),
          whatsappText: composeWhatsApp(fields),
          sources: fields.sources.map((s) => ({ ...s, publisher: publisherFor(s.url) })),
          flags,
          model: healthAgentModel(),
          status: rejected ? 'rejected' : 'draft',
          rejectionReason: rejected
            ? `Automatic safety check: ${flags.filter((f) => f.level === 'block').map((f) => f.message).join(' ')}`
            : null,
        },
      });
      results.push({ topic: topic.id, outcome: rejected ? 'auto-rejected' : 'draft', id: saved.id, flags });
    } catch (err) {
      console.error(`[health-agent] ${topic.id} failed:`, err);
      results.push({ topic: topic.id, outcome: 'error', reason: err instanceof Error ? err.message : 'Unknown error.' });
      if (err instanceof HealthAgentError && err.code === 'NOT_CONFIGURED') break; // every topic would fail the same way
    }
  }
  return results;
}
