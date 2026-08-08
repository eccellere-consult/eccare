'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Phone, CalendarDays, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { speak } from '@/lib/speech';

type Suggestion =
  | { type: 'appointment'; message: string }
  | { type: 'call'; message: string; phone: string };

interface Companion {
  greeting: string;
  moodLoggedToday: boolean;
  todaysMood: string | null;
  suggestions: Suggestion[];
}

const MOOD_OPTIONS: { value: 'great' | 'good' | 'okay' | 'low' | 'not_well'; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😊', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'low', emoji: '😕', label: 'Low' },
  { value: 'not_well', emoji: '😟', label: 'Not well' },
];

/** The AI Companion's proactive greeting on the elder home page — opens the
 *  conversation instead of waiting to be asked (mood check-in, an upcoming
 *  appointment, a nudge to call family). Fetches once on mount; the greeting is
 *  spoken best-effort (browsers vary on unprompted speechSynthesis, so the text is
 *  always shown regardless of whether audio plays). Dismissed suggestions and the
 *  "already spoken today" flag live in sessionStorage/localStorage only — nothing
 *  server-side to track, this is just a don't-repeat-yourself throttle. */
export function CompanionCard() {
  const [data, setData] = useState<Companion | null>(null);
  const [loggingMood, setLoggingMood] = useState(false);
  const [loggedMood, setLoggedMood] = useState<string | null>(null);
  const [dismissedTypes, setDismissedTypes] = useState<string[]>([]);
  const spokenRef = useRef(false);

  useEffect(() => {
    fetch('/api/v1/voice/companion', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        setData(j.data);
        const todayKey = `ec_companion_spoken_${new Date().toDateString()}`;
        if (!spokenRef.current && !sessionStorage.getItem(todayKey)) {
          spokenRef.current = true;
          sessionStorage.setItem(todayKey, '1');
          speak(j.data.greeting);
        }
      })
      .catch(() => {});
  }, []);

  async function logMood(mood: string) {
    setLoggingMood(true);
    try {
      const res = await fetch('/api/v1/health/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mood }),
      });
      const json = await res.json();
      if (json.success) setLoggedMood(mood);
    } finally {
      setLoggingMood(false);
    }
  }

  if (!data) return null;

  const moodLabel = MOOD_OPTIONS.find((m) => m.value === (loggedMood ?? ''))?.label;
  const alreadyLogged = data.moodLoggedToday || Boolean(loggedMood);
  const visibleSuggestions = data.suggestions.filter((s) => !dismissedTypes.includes(s.type));

  return (
    <Card className="border-accent-100 bg-accent-50">
      <CardContent className="py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
            <Sparkles className="h-5 w-5 text-accent-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-accent-900">{data.greeting}</p>

            {alreadyLogged ? (
              <p className="mt-2 text-sm text-accent-900/80">
                You told us you&rsquo;re feeling {moodLabel?.toLowerCase() ?? data.todaysMood} today. 💚
              </p>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-semibold text-accent-900">How are you feeling today?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => logMood(m.value)}
                      disabled={loggingMood}
                      className="flex items-center gap-1.5 rounded-full border border-accent-100 bg-surface px-3 py-2 text-sm font-semibold text-accent-900 shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
                    >
                      <span className="text-base">{m.emoji}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleSuggestions.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {visibleSuggestions.map((s) => (
                  <div key={s.type} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
                    {s.type === 'appointment' ? (
                      <CalendarDays className="h-4 w-4 shrink-0 text-primary-600" />
                    ) : (
                      <Phone className="h-4 w-4 shrink-0 text-primary-600" />
                    )}
                    <p className="min-w-0 flex-1 text-sm text-text">{s.message}</p>
                    {s.type === 'call' && (
                      <a
                        href={`tel:${s.phone}`}
                        className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Call
                      </a>
                    )}
                    <button
                      onClick={() => setDismissedTypes((d) => [...d, s.type])}
                      aria-label="Dismiss"
                      className="shrink-0 text-text-secondary hover:text-text"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
