'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSpeechRecognitionSupported, createRecognizer, speak, type Recognizer } from '@/lib/speech';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

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

export function VoiceAssistant() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const recognizerRef = useRef<Recognizer | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = isSpeechRecognitionSupported();

  const scheduleDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setStatus('idle');
      setTranscript('');
      setReply('');
      setErrorMessage('');
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
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
      }
      // book_appointment / order_food / send_family_message / set_reminder /
      // check_status / unknown — no backing feature yet, speak-only is honest.
    },
    [router],
  );

  const handleTranscript = useCallback(
    async (text: string) => {
      setTranscript(text);
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

        const result: VoiceResult = json.data;
        setReply(result.response);
        setStatus('speaking');
        speak(result.response);
        await dispatchAction(result.action, result.actionData);
        scheduleDismiss();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setStatus('error');
        scheduleDismiss();
      }
    },
    [dispatchAction, scheduleDismiss],
  );

  function startListening() {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setTranscript('');
    setReply('');
    setErrorMessage('');

    const recognizer = createRecognizer();
    if (!recognizer) return;
    recognizerRef.current = recognizer;

    recognizer.onresult = (event) => {
      const text = event.results[0][0].transcript;
      handleTranscript(text);
    };
    recognizer.onerror = (event) => {
      if (event.error === 'no-speech') {
        setStatus('idle');
        return;
      }
      setErrorMessage(
        event.error === 'not-allowed'
          ? 'Please allow microphone access to use Speak to EC.'
          : 'Could not hear you. Please try again.',
      );
      setStatus('error');
      scheduleDismiss();
    };
    recognizer.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
    };

    setStatus('listening');
    recognizer.start();
  }

  function handleTap() {
    if (status === 'listening') {
      recognizerRef.current?.stop();
    } else if (status !== 'thinking') {
      startListening();
    }
  }

  if (!supported) return null;

  const showBubbles = (transcript || reply || errorMessage) && status !== 'listening';

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6">
      {showBubbles && (
        <div className="flex w-72 flex-col gap-2">
          {transcript && (
            <div className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm text-white shadow-lg">
              <p className="text-[10px] font-bold uppercase opacity-80">You said</p>
              <p className="mt-0.5">{transcript}</p>
            </div>
          )}
          {reply && (
            <div className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-text shadow-lg">
              <p className="text-[10px] font-bold uppercase text-primary-600">EC</p>
              <p className="mt-0.5">{reply}</p>
            </div>
          )}
          {errorMessage && (
            <div className="rounded-2xl bg-danger-50 px-4 py-2.5 text-sm text-danger-900 shadow-lg">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {status === 'listening' && (
        <span className="rounded-full bg-danger-600 px-3 py-1 text-xs font-semibold text-white shadow">
          Listening…
        </span>
      )}

      <button
        onClick={handleTap}
        aria-label={status === 'listening' ? 'Stop listening' : 'Speak to EC'}
        disabled={status === 'thinking'}
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-accent-100 transition-transform',
          status === 'listening' ? 'scale-110 animate-pulse bg-danger-600' : 'bg-accent-600 hover:bg-accent-900',
          status === 'thinking' && 'opacity-70',
        )}
      >
        {status === 'thinking' ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
      </button>
    </div>
  );
}
