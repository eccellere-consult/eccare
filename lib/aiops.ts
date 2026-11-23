// Reports every AI call this app makes to the owner's AI Control Tower (a separate private service) so usage,
// tokens, speed and failures can be seen in one place. SERVER SIDE ONLY.
//
// Safe by default:
//  - Until BOTH AIOPS_ENDPOINT and AIOPS_KEY are set on the server, nothing at all happens: no network call,
//    no error, no log line. trackAiCall() simply runs the AI call and hands back its answer.
//  - It never throws, never changes what an AI call returns or which error it raises, and never makes the caller
//    wait: reports are sent in the background and the client gives up after 2 seconds.
//
// Privacy (health and elder-care data, so extra strict):
//  - Only technical facts leave the server: provider, model, token counts, time taken, success/failed/timeout,
//    a short error code, a fixed capability name, and a one-way hash of the user id (made by the client).
//  - NEVER passed in here, by design: prompts, answers, transcripts, audio, medicines, names, e-mails, phone
//    numbers, error message text, or anything about health or family. The functions below have no field for them.
//  - No cost is sent; the Control Tower works that out from the tokens.
//
// This file imports the client with an explicit ".ts" so the small tests can load it directly with Node.

import { createControlTower } from './aiops-client.ts';

type Tower = ReturnType<typeof createControlTower>;

export const AIOPS_APP_CODE = 'eccare';

/** The fixed list of things this app asks AI to do. Stable names: renaming one splits its history in the Control Tower. */
export const AI_CAPABILITIES = {
  voiceCommand: { capability: 'voice_command', module: 'voice' },
  companionGreeting: { capability: 'companion_greeting', module: 'voice' },
  speechToText: { capability: 'speech_to_text', module: 'voice' },
  textToSpeech: { capability: 'text_to_speech', module: 'voice' },
  prescriptionReading: { capability: 'prescription_reading', module: 'health' },
  healthBulletinDraft: { capability: 'health_bulletin_draft', module: 'health' },
  dailyQuoteGeneration: { capability: 'daily_quote_generation', module: 'content' },
  whatsappTranslation: { capability: 'whatsapp_translation', module: 'messaging' },
  catalogItemDraft: { capability: 'catalog_item_draft', module: 'catalog' },
  catalogShelfDraft: { capability: 'catalog_shelf_draft', module: 'catalog' },
  listingPhotoDraft: { capability: 'listing_photo_draft', module: 'listings' },
} as const;

export interface AiCapability {
  capability: string;
  module: string;
}

/** Token numbers exactly as the provider returned them (see the Control Tower's "cached tokens" note). */
export interface AiUsage {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}

export interface AiCallMeta extends AiCapability {
  /** 'anthropic' | 'openai' | 'xai' | 'azure' */
  provider: string;
  /** The model asked for; replaced by the one the provider reports when the call succeeds. */
  model?: string;
  /** Your own id for the person. Hashed by the client before it leaves the server. Optional. */
  userId?: string | number;
  /** Which try this was when the app itself retries (0 = first try). */
  retryCount?: number;
}

export type AiStatus = 'success' | 'failed' | 'timeout';

export interface AiOutcome {
  status: AiStatus;
  latencyMs: number;
  usage?: AiUsage;
  errorCode?: string;
}

/** Given to the function being timed, so it can pass back what only it can see. */
export interface AiCallHandle {
  setUsage(usage: AiUsage | undefined): void;
  setErrorCode(code: string): void;
}

// ── The client, made lazily from the server's settings ───────────────────────────────────────────────────────────

let cached: { id: string; tower: Tower } | null = null;

/** The client, or null when the two settings are not both present (then everything below does nothing). */
function getTower(): Tower | null {
  try {
    const endpoint = (process.env.AIOPS_ENDPOINT ?? '').trim();
    const apiKey = (process.env.AIOPS_KEY ?? '').trim();
    if (!endpoint || !apiKey) return null;
    const id = `${endpoint}|${apiKey}`;
    if (!cached || cached.id !== id) {
      cached = { id, tower: createControlTower({ endpoint, apiKey, appCode: AIOPS_APP_CODE, timeoutMs: 2000 }) };
    }
    return cached.tower;
  } catch {
    return null;
  }
}

export function aiopsEnabled(): boolean {
  return getTower() !== null;
}

// ── Reading provider answers ─────────────────────────────────────────────────────────────────────────────────────

const toCount = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined);

/** Anthropic answer (SDK message, or the raw JSON of /v1/messages). Cached tokens are counted SEPARATELY from input. */
export function anthropicUsage(answer: unknown): AiUsage | undefined {
  const a = answer as { model?: unknown; usage?: Record<string, unknown> } | null | undefined;
  const u = a?.usage;
  if (!u || typeof u !== 'object') return undefined;
  return {
    model: typeof a?.model === 'string' ? a.model : undefined,
    inputTokens: toCount(u.input_tokens),
    outputTokens: toCount(u.output_tokens),
    cachedTokens: toCount(u.cache_read_input_tokens),
  };
}

/** OpenAI-style answer (also xAI). Cached tokens are INCLUDED in the input count. */
export function openAiUsage(answer: unknown): AiUsage | undefined {
  const a = answer as { model?: unknown; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; prompt_tokens_details?: { cached_tokens?: unknown } } } | null | undefined;
  const u = a?.usage;
  if (!u || typeof u !== 'object') return undefined;
  return {
    model: typeof a?.model === 'string' ? a.model : undefined,
    inputTokens: toCount(u.prompt_tokens),
    outputTokens: toCount(u.completion_tokens),
    cachedTokens: toCount(u.prompt_tokens_details?.cached_tokens),
  };
}

// ── Describing a failure without ever sending its message text ───────────────────────────────────────────────────

/** True when the error means "took too long" (our own limit, a fetch timeout, or a provider SDK timeout). */
export function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown } | null | undefined;
  const text = `${typeof e?.name === 'string' ? e.name : ''} ${typeof e?.message === 'string' ? e.message : ''}`;
  return /abort|timeout|timed out|took too long/i.test(text);
}

/** A short, safe code: the HTTP status when the error carries one, otherwise the error's class name. Never the message. */
export function errorCodeOf(err: unknown): string {
  const e = err as { status?: unknown; name?: unknown } | null | undefined;
  if (typeof e?.status === 'number' && e.status >= 100 && e.status <= 599) return `http_${e.status}`;
  const name = typeof e?.name === 'string' ? e.name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60) : '';
  return name || 'error';
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sends one report. Resolves (never rejects) with whether it was accepted. Callers do not await it. */
export async function reportAiCall(meta: AiCallMeta, outcome: AiOutcome): Promise<boolean> {
  try {
    const tower = getTower();
    if (!tower) return false;
    const usage = outcome.status === 'success' ? outcome.usage : undefined;
    return await tower.recordAIRequest({
      capabilityCode: meta.capability,
      moduleCode: meta.module,
      userId: meta.userId,
      provider: meta.provider,
      model: usage?.model || meta.model,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      cachedTokens: usage?.cachedTokens,
      latencyMs: Math.max(0, Math.round(outcome.latencyMs)),
      retryCount: meta.retryCount ?? 0,
      status: outcome.status,
      errorCode: outcome.status === 'success' ? undefined : outcome.errorCode,
    });
  } catch {
    return false;
  }
}

/**
 * Runs one AI call, times it and reports it afterwards (success, failed or timeout), then returns the call's own
 * answer, or throws the call's own error, untouched. Without the two settings it is just `run(...)`.
 *
 *   const message = await trackAiCall(
 *     { ...AI_CAPABILITIES.voiceCommand, provider: 'anthropic', model: 'claude-haiku-4-5' },
 *     () => anthropic.messages.create({ ... }),
 *     anthropicUsage,
 *   );
 *
 * `readUsage` turns the answer into token counts. When the answer is not what holds them (for example a call
 * wrapped in a time limit that returns something else), use `call.setUsage(...)` inside `run` instead.
 */
export async function trackAiCall<T>(
  meta: AiCallMeta,
  run: (call: AiCallHandle) => Promise<T>,
  readUsage?: (answer: T) => AiUsage | undefined,
): Promise<T> {
  if (!getTower()) return run({ setUsage() {}, setErrorCode() {} });

  const started = Date.now();
  let usage: AiUsage | undefined;
  let errorCode: string | undefined;
  const call: AiCallHandle = {
    setUsage(u) {
      usage = u;
    },
    setErrorCode(code) {
      errorCode = code;
    },
  };

  let answer: T;
  try {
    answer = await run(call);
  } catch (err) {
    try {
      void reportAiCall(meta, {
        status: isTimeoutError(err) ? 'timeout' : 'failed',
        latencyMs: Date.now() - started,
        errorCode: errorCode ?? errorCodeOf(err),
      });
    } catch {
      // reporting must never change what the caller sees
    }
    throw err;
  }

  try {
    if (!usage && readUsage) usage = readUsage(answer);
  } catch {
    usage = undefined;
  }
  void reportAiCall(meta, { status: 'success', latencyMs: Date.now() - started, usage });
  return answer;
}
