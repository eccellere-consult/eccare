'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Loader2, Check, X, Mic, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSpeechRecognitionSupported, createRecognizer, type Recognizer } from '@/lib/speech';
import { isConfirmRequiredAction, elderScreenPath, type ConfirmRequiredAction } from '@/lib/voice-shared';
import { aryaVoice } from '@/lib/arya-voice';
import { aryaIntroduction, aryaWelcomeBack } from '@/lib/arya-greeting';
import { AryaAvatar } from '@/components/arya-avatar';

// The 3D engine is ~700 KB — loaded on demand, never in the server bundle.
const Arya3D = dynamic(() => import('@/components/arya/arya-3d').then((m) => m.Arya3D), { ssr: false });

type Status = 'idle' | 'listening' | 'thinking' | 'confirming' | 'executing' | 'speaking' | 'error';

interface VoiceResult {
  intent: string;
  response: string;
  action: string;
  actionData?: Record<string, unknown>;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface PendingAction {
  action: ConfirmRequiredAction;
  actionData?: Record<string, unknown>;
}

const GREETED_KEY = 'arya_greeted';
const IDLE_CLOSE_MS = 2 * 60 * 1000;
const SUGGESTIONS = ['Show my medicines', 'Where are my payments?', 'I would like some help'];

function getLocation(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 5000 },
    );
  });
}

/** Resolves a call_contact action against the elder's real emergency contacts —
 *  Claude already saw this same list as context, so a match should usually succeed. */
async function callContact(actionData: Record<string, unknown> | undefined) {
  const res = await fetch('/api/v1/emergency/contacts', { credentials: 'include' });
  const json = await res.json();
  if (!json.success) return;

  const contacts: EmergencyContact[] = json.data;
  const relationship = typeof actionData?.relationship === 'string' ? actionData.relationship.toLowerCase() : '';
  const contactName = typeof actionData?.contactName === 'string' ? actionData.contactName.toLowerCase() : '';

  const match = contacts.find(
    (c) =>
      (relationship && c.relationship.toLowerCase().includes(relationship)) ||
      (contactName && c.name.toLowerCase().includes(contactName)),
  );
  if (match) window.location.href = `tel:${match.phone}`;
}

function alreadyGreeted(): boolean {
  try {
    return sessionStorage.getItem(GREETED_KEY) === '1';
  } catch {
    return false;
  }
}

function markGreeted() {
  try {
    sessionStorage.setItem(GREETED_KEY, '1');
  } catch {
    // private mode — she will simply greet again next time
  }
}

export function VoiceAssistant({ userName }: { userName?: string }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [stageReady, setStageReady] = useState(false); // 3D mounts after first paint, never blocking it
  const [tabVisible, setTabVisible] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [greetNonce, setGreetNonce] = useState(0);
  const [muted, setMuted] = useState(false);
  const recognizerRef = useRef<Recognizer | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped whenever the conversation is reset/closed, so a late reply can't revive a closed panel. */
  const runRef = useRef(0);
  const openRef = useRef(false);
  /** startListening is defined before handleTranscript (which itself calls it), so it reaches it through this ref. */
  const handleTranscriptRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    setMuted(aryaVoice.isMuted());
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => setStageReady(true), { timeout: 2500 }) : window.setTimeout(() => setStageReady(true), 1200);
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (idle && cancel) cancel(handle as number);
      else clearTimeout(handle as number);
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  };

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setStatus('error');
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMessage('');
      setStatus((s) => (s === 'error' ? 'idle' : s));
    }, 6000);
  }, []);

  const closeArya = useCallback(() => {
    runRef.current++;
    clearIdleTimer();
    aryaVoice.stop();
    recognizerRef.current?.stop();
    setOpen(false);
    setStatus('idle');
    setTranscript('');
    setReply('');
    setErrorMessage('');
    setPendingAction(null);
  }, []);

  /** Closes Arya after a couple of quiet minutes, so a forgotten panel does not keep rendering 3D. */
  const touch = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(closeArya, IDLE_CLOSE_MS);
  }, [closeArya]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeArya();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeArya]);

  useEffect(() => () => {
    clearIdleTimer();
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    aryaVoice.stop();
  }, []);

  const startListening = useCallback(() => {
    touch();
    setTranscript('');
    setErrorMessage('');
    setPendingAction(null);
    aryaVoice.stop();

    const recognizer = createRecognizer();
    if (!recognizer) return;
    recognizerRef.current = recognizer;

    recognizer.onresult = (event) => {
      const text = event.results[0][0].transcript;
      void handleTranscriptRef.current(text);
    };
    recognizer.onerror = (event) => {
      if (event.error === 'no-speech') {
        setStatus('idle');
        return;
      }
      showError(
        event.error === 'not-allowed'
          ? 'Please allow microphone access to speak to Arya.'
          : 'Could not hear you. Please try again.',
      );
    };
    recognizer.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
    };

    setStatus('listening');
    try {
      recognizer.start();
    } catch {
      setStatus('idle'); // already started — ignore
    }
  }, [showError, touch]);

  /** Says something, shows it as a caption, and resolves when she has finished. */
  const say = useCallback(async (text: string, run: number) => {
    setReply(text);
    setStatus('speaking');
    await aryaVoice.speak(text);
    if (run === runRef.current) setStatus((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  const dispatchAction = useCallback(
    async (action: string, actionData: Record<string, unknown> | undefined) => {
      if (action === 'trigger_sos') {
        const { lat, lng } = await getLocation();
        await fetch('/api/v1/emergency/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ triggerType: 'voice', lat, lng }),
        }).catch(() => {});
        return;
      }

      if (action === 'call_contact') {
        await callContact(actionData).catch(() => {});
        return;
      }

      if (action === 'show_medicines' || action === 'show_appointments') {
        router.push('/elder/health');
        return;
      }

      if (action === 'navigate') {
        // Only keys from the ELDER_SCREENS whitelist ever resolve to a path.
        const path = elderScreenPath(actionData?.screen);
        if (path) router.push(path);
      }
      // check_status / unknown / none — no navigation, Arya's spoken response is
      // the whole answer. The CONFIRM_REQUIRED_ACTIONS never reach here — see
      // handleTranscript, which routes them to the confirm step instead.
    },
    [router],
  );

  const handleTranscript = useCallback(
    async (text: string) => {
      const run = ++runRef.current;
      touch();
      setTranscript(text);
      setReply('');
      setStatus('thinking');
      try {
        const res = await fetch('/api/v1/voice/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ transcript: text }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Something went wrong.');
        if (run !== runRef.current || !openRef.current) return;

        const result: VoiceResult = json.data;

        if (isConfirmRequiredAction(result.action)) {
          // Wait for an explicit tap — response is phrased as a question by the
          // system prompt, so speaking it alone is the ask; nothing runs yet.
          setPendingAction({ action: result.action, actionData: result.actionData });
          setReply(result.response);
          setStatus('confirming');
          void aryaVoice.speak(result.response);
          touch();
          return;
        }

        const speaking = say(result.response, run);
        await dispatchAction(result.action, result.actionData);
        await speaking;
        // A clarifying question ("which doctor?") means she is waiting for an answer — listen again.
        if (run === runRef.current && openRef.current && result.action === 'none' && /\?\s*$/.test(result.response)) {
          startListening();
        }
      } catch (err) {
        if (run === runRef.current) showError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    },
    [dispatchAction, say, showError, startListening, touch],
  );

  useEffect(() => {
    handleTranscriptRef.current = handleTranscript;
  }, [handleTranscript]);

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const run = ++runRef.current;
    touch();
    setStatus('executing');
    try {
      const res = await fetch('/api/v1/voice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pendingAction),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Something went wrong.');

      // A logical "couldn't do it" (e.g. no matching family member) still comes
      // back here with success:true at the HTTP level and its own friendly
      // message — spoken the same as a real success, not treated as an error.
      const { message, redirectUrl } = json.data as { success: boolean; message: string; redirectUrl?: string };
      if (redirectUrl) window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      setPendingAction(null);
      await say(message, run);
    } catch (err) {
      setPendingAction(null);
      showError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  function cancelPendingAction() {
    const run = ++runRef.current;
    setPendingAction(null);
    void say('Okay, no problem.', run);
    touch();
  }

  /** Opens Arya. Must run inside the tap itself so the browser lets her speak. */
  function openArya(forceIntro = false) {
    aryaVoice.unlock();
    const run = ++runRef.current;
    setOpen(true);
    openRef.current = true;
    setTranscript('');
    setErrorMessage('');
    setPendingAction(null);
    touch();

    const intro = forceIntro || !alreadyGreeted();
    if (intro) {
      markGreeted();
      setGreetNonce((n) => n + 1);
    }
    void (async () => {
      await say(intro ? aryaIntroduction(userName) : aryaWelcomeBack(userName), run);
      if (run === runRef.current && openRef.current) startListening(); // she has asked — now she listens
    })();
  }

  function handleMic() {
    aryaVoice.unlock();
    if (status === 'listening') {
      recognizerRef.current?.stop();
    } else if (status !== 'thinking' && status !== 'executing') {
      runRef.current++; // interrupts anything she is saying
      startListening();
    }
  }

  function toggleMute() {
    const next = !muted;
    aryaVoice.setMuted(next);
    setMuted(next);
  }

  if (!supported) return null;

  const aryaState = status === 'listening' ? 'listening' : status === 'thinking' || status === 'executing' ? 'thinking' : status === 'speaking' ? 'speaking' : 'idle';
  const busy = status === 'thinking' || status === 'executing';
  const fallback = <AryaAvatar active={status === 'listening' || status === 'speaking'} size={open ? 220 : 80} />;
  const stage = stageReady ? (
    <Arya3D state={aryaState} variant={open ? 'full' : 'compact'} greetNonce={greetNonce} paused={!tabVisible} fallback={fallback} />
  ) : (
    <div className="flex h-full w-full items-center justify-center">{fallback}</div>
  );

  const statusLabel =
    status === 'listening' ? 'Listening…' : busy ? 'Thinking…' : status === 'speaking' ? 'Speaking…' : status === 'confirming' ? 'Waiting for your answer' : '';

  return (
    <div
      className={cn(
        'fixed bottom-20 right-4 z-40 md:bottom-6',
        open ? 'w-[min(92vw,22rem)]' : 'h-[88px] w-[88px]',
      )}
    >
      {!open && (
        <span className="pointer-events-none absolute right-[96px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-primary-600 shadow-lg">
          Ask Arya
        </span>
      )}

      <div
        role={open ? 'dialog' : undefined}
        aria-label={open ? 'Arya, your care companion' : undefined}
        className={cn(
          'relative overflow-hidden bg-gradient-to-b from-primary-50 to-accent-50 shadow-xl shadow-accent-100/60',
          open ? 'rounded-3xl border border-border bg-surface' : 'h-full w-full rounded-full border-2 border-white',
        )}
      >
        <div
          className={cn(
            'relative w-full bg-gradient-to-b from-primary-50 via-white to-accent-50',
            open ? 'h-72' : 'h-full',
            status === 'listening' && !open && 'ring-4 ring-danger-600/50',
          )}
        >
          {stage}

          {open && (
            <>
              <div className="absolute left-3 top-3 rounded-2xl bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <p className="text-lg font-bold leading-tight text-primary-900">Arya</p>
                <p className="text-xs font-medium text-text-secondary">Your care companion</p>
              </div>
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? 'Turn Arya’s voice on' : 'Turn Arya’s voice off'}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-primary-900 shadow"
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button
                  onClick={closeArya}
                  aria-label="Close Arya"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-primary-900 shadow"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {statusLabel && (
                <span
                  className={cn(
                    'absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow',
                    status === 'listening' ? 'bg-danger-600' : 'bg-primary-600',
                  )}
                >
                  {busy && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                  {statusLabel}
                </span>
              )}
            </>
          )}
        </div>

        {open && (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex max-h-48 min-h-[3.5rem] flex-col gap-2 overflow-y-auto" aria-live="polite">
              {transcript && (
                <div className="self-end rounded-2xl rounded-br-md bg-primary-600 px-4 py-2 text-sm text-white">
                  <p className="text-[10px] font-bold uppercase opacity-80">You said</p>
                  <p className="mt-0.5">{transcript}</p>
                </div>
              )}
              {reply && (
                <div className="rounded-2xl rounded-bl-md bg-primary-50 px-4 py-2 text-[15px] leading-snug text-text">
                  <p className="text-[10px] font-bold uppercase text-primary-600">Arya</p>
                  <p className="mt-0.5">{reply}</p>
                </div>
              )}
              {errorMessage && (
                <div className="rounded-2xl bg-danger-50 px-4 py-2 text-sm text-danger-900">{errorMessage}</div>
              )}
            </div>

            {status === 'confirming' && (
              <div className="flex gap-2">
                <button
                  onClick={confirmPendingAction}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-success-600 text-base font-bold text-white shadow pointer-coarse:h-16"
                >
                  <Check className="h-5 w-5" />
                  Yes
                </button>
                <button
                  onClick={cancelPendingAction}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface text-base font-bold text-text shadow pointer-coarse:h-16"
                >
                  <X className="h-5 w-5" />
                  No
                </button>
              </div>
            )}

            {status !== 'confirming' && !transcript && !busy && status !== 'listening' && (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleTranscript(s)}
                    className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-primary-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleMic}
              disabled={busy}
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg pointer-coarse:h-16',
                status === 'listening' ? 'bg-danger-600' : 'bg-primary-600',
                busy && 'opacity-60',
              )}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
              {status === 'listening' ? 'Tap when you are done' : busy ? 'One moment…' : 'Tap to speak'}
            </button>

            <button
              onClick={() => openArya(true)}
              className="flex items-center justify-center gap-1.5 self-center py-1 text-sm font-medium text-text-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Hear Arya’s introduction again
            </button>
          </div>
        )}

        {!open && (
          <button
            onClick={() => openArya()}
            aria-label="Speak to Arya"
            className="absolute inset-0 rounded-full focus-visible:outline-4 focus-visible:outline-primary-600"
          />
        )}
      </div>
    </div>
  );
}
