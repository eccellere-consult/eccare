import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAuthUser } from '@/lib/auth';
import { ok, fail } from '@/lib/health-access';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
// Whatever expo-av records on Android (m4a/aac) plus common web fallbacks.
const ALLOWED_TYPES = ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/x-m4a'];

/** Generic speech-to-text: accepts a short recorded audio clip, returns the
 *  transcribed text for the caller to review/edit before doing anything with it —
 *  this route never writes to any model itself. Pilot consumer is mobile's Health
 *  Notes voice input; the same endpoint is meant to be reused later for real "Speak
 *  to EC" mic input, so it deliberately stays generic (no note/elder-specific
 *  logic here). OpenAI Whisper is the only current AI provider (of the
 *  Anthropic/OpenAI/Grok trio already used for prescriptions/quotes) that does audio
 *  transcription — no multi-provider fallback chain like those, since only one
 *  provider actually supports this. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  if (!process.env.OPENAI_API_KEY) {
    return fail('NOT_CONFIGURED', 'Voice transcription is not available right now.', 503);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded audio.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No audio uploaded.');
  if (!ALLOWED_TYPES.some((t) => file.type.startsWith(t.split('/')[0]))) {
    return fail('VALIDATION', 'Unsupported audio format.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'Recording must be under 10 MB (about a few minutes).');

  try {
    // Instantiated per-request, not at module load — a client built at import time
    // would capture `process.env.OPENAI_API_KEY` before it's actually set on this
    // host, the same lazy-init bug already fixed once in lib/prescription-ai.ts /
    // lib/quote-ai.ts / lib/claude.ts.
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const bytes = await file.arrayBuffer();
    const audioFile = await OpenAI.toFile(Buffer.from(bytes), file.name || 'recording.m4a');

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    return ok({ transcript: transcription.text });
  } catch (err) {
    return fail('TRANSCRIPTION_FAILED', err instanceof Error ? err.message : 'Could not transcribe audio.', 502);
  }
}
