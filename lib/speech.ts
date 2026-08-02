// Web Speech API — browser-native STT/TTS, zero vendor dependency. SpeechRecognition
// works in Chrome/Edge (desktop + Android) and Safari 14.1+, but not in Firefox at
// all. Callers must feature-detect with isSpeechRecognitionSupported() before
// showing any mic UI. English-only for v1 (en-IN) — EC_SYSTEM_PROMPT (lib/claude.ts)
// only understands/replies in English today, so recognizing other languages would
// just produce transcripts the backend can't act on.

interface SpeechRecognitionResultLike {
  [index: number]: { [index: number]: { transcript: string } };
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface Recognizer {
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => Recognizer) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognizer;
    webkitSpeechRecognition?: new () => Recognizer;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** A single-utterance English recognizer, or null if unsupported. */
export function createRecognizer(): Recognizer | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognizer = new Ctor() as Recognizer & {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
  };
  recognizer.lang = 'en-IN';
  recognizer.continuous = false;
  recognizer.interimResults = false;
  return recognizer;
}

export function speak(text: string): void {
  if (!isSpeechSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  window.speechSynthesis.speak(utterance);
}
