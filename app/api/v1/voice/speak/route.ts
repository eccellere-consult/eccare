import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { fail } from '@/lib/health-access';

// Arya's spoken voice. Browser speechSynthesis (lib/speech.ts) is the last-resort
// fallback, but its quality varies wildly by device — on many Android phones and
// every desktop Linux box there is no Indian-English voice at all. This route gives
// every device the same warm, authentic Indian-English voice, in this order:
//
//   1. Azure Neural TTS  — en-IN-NeerjaNeural, a native Indian-English voice
//                          (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)
//   2. OpenAI TTS        — gpt-4o-mini-tts steered with accent/persona instructions
//                          (OPENAI_API_KEY, already used for Whisper)
//   3. Neither           — 503 NOT_CONFIGURED; the client falls back to the browser voice

const MAX_CHARS = 600; // a few sentences — Arya's replies are capped at two, the greeting is the longest
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

const schema = z.object({ text: z.string().trim().min(1).max(MAX_CHARS) });

/** Per-user sliding window. In-memory is enough here: the app runs as a single Node
 *  process (server.js), and this only exists to stop a runaway client loop from
 *  burning paid TTS credits, not to be a security boundary. */
const recentRequests = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    recentRequests.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentRequests.set(userId, recent);
  return false;
}

const OPENAI_VOICE_INSTRUCTIONS = [
  'Voice: a warm, composed Indian woman in her mid-thirties — a trusted family counsellor.',
  'Accent: natural, educated urban Indian English with authentic Indian rhythm, stress and intonation — not British or American.',
  'Pronounce Indian names and words (Namaste, ji) the way a native speaker would.',
  'Tone: respectful, calm, kind and reassuring, with a gentle smile in the voice.',
  'Pace: unhurried and very clear, slightly slower than normal conversation because the listener is elderly, with natural pauses between sentences.',
].join(' ');

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

async function synthesizeWithAzure(text: string): Promise<Buffer> {
  const region = process.env.AZURE_SPEECH_REGION!;
  const voice = process.env.AZURE_SPEECH_VOICE || 'en-IN-NeerjaNeural';
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">` +
    `<voice name="${voice}"><prosody rate="-8%">${escapeXml(text)}</prosody></voice></speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'eccare-arya',
    },
    body: ssml,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Azure TTS responded ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthesizeWithOpenAI(text: string): Promise<Buffer> {
  // Per-request client — see the lazy-init note in app/api/v1/voice/transcribe/route.ts.
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const speech = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: process.env.OPENAI_TTS_VOICE || 'shimmer',
    input: text,
    instructions: OPENAI_VOICE_INSTRUCTIONS,
    response_format: 'mp3',
  });
  return Buffer.from(await speech.arrayBuffer());
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('VALIDATION', 'Nothing to say.');

  const useAzure = Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
  const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
  if (!useAzure && !useOpenAI) return fail('NOT_CONFIGURED', 'Arya’s voice is not available right now.', 503);

  if (rateLimited(auth.userId)) return fail('RATE_LIMITED', 'Arya needs a short rest. Please try again in a moment.', 429);

  const text = parsed.data.text;
  const attempts: Array<{ provider: string; run: () => Promise<Buffer> }> = [];
  if (useAzure) attempts.push({ provider: 'azure', run: () => synthesizeWithAzure(text) });
  if (useOpenAI) attempts.push({ provider: 'openai', run: () => synthesizeWithOpenAI(text) });

  for (const { provider, run } of attempts) {
    try {
      const audio = await run();
      return new NextResponse(new Uint8Array(audio), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'private, no-store',
          'X-Arya-Voice': provider,
        },
      });
    } catch (err) {
      // Falls through to the next provider (Azure → OpenAI), then to a 502 the
      // client treats as "use the browser voice".
      console.error(`[voice] speak via ${provider} failed:`, err);
    }
  }

  return fail('TTS_FAILED', 'Could not generate Arya’s voice.', 502);
}
