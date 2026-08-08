'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { speak } from '@/lib/speech';

interface DueReminder {
  id: string;
  message: string;
  remindAt: string;
}

const POLL_MS = 30_000;

/** Polls for due voice-created reminders while the elder's app is open and surfaces
 *  each one as a prominent, spoken in-app alert — the in-app stand-in for real push
 *  delivery (see app/api/v1/voice/reminders/due/route.ts for why: this app has no
 *  Web Push token collection yet). Only fires while a tab is open; a reminder set
 *  for 4pm won't reach the elder if the app isn't open at 4pm. */
export function ReminderAlerts() {
  const [queue, setQueue] = useState<DueReminder[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/v1/voice/reminders/due', { credentials: 'include' });
        const json = await res.json();
        if (cancelled || !json.success || json.data.length === 0) return;

        const due: DueReminder[] = json.data;
        setQueue((q) => [...q, ...due]);
        due.forEach((r) => speak(`Reminder: ${r.message}`));
      } catch {
        // Silent — the next poll retries; a transient network blip shouldn't show
        // an error the elder can't act on.
      }
    }

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function dismiss(id: string) {
    setQueue((q) => q.filter((r) => r.id !== id));
  }

  if (queue.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3">
      {queue.map((r) => (
        <div
          key={r.id}
          className="flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-accent-600 bg-surface px-4 py-3 shadow-xl"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-50">
            <Bell className="h-5 w-5 text-accent-600" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold text-text">{r.message}</p>
          <button
            onClick={() => dismiss(r.id)}
            aria-label="Dismiss reminder"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-primary-50 hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
