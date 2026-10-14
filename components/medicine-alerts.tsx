'use client';

import { useEffect, useRef, useState } from 'react';
import { Pill, X, Check, Clock } from 'lucide-react';
import { speak } from '@/lib/speech';
import { playMedicineBeep } from '@/lib/beep';

interface DueMedicationReminder {
  id: string;
  scheduledAt: string;
  status: 'pending' | 'taken' | 'missed' | 'snoozed';
  medication: { name: string; dosage: string; instructions: string | null };
}

const POLL_MS = 30_000;
// How often an unacknowledged reminder re-beeps while it stays due — a real
// alarm should nag a little, not chime once and go silent for the rest of
// the day. But it must not nag for ever either: after MAX_BEEPS the banner
// stays on screen, silently, until someone answers it.
const RE_BEEP_MS = 5 * 60_000;
const MAX_BEEPS = 3;
// A reminder that was answered ("Taken", "Snooze", or hidden) stays quiet on this device even if
// the answer could not be saved for some reason (offline, a refused request). Without this the
// alert came straight back on the next check and beeped again.
const HIDE_MS = 30 * 60_000;
const SNOOZE_MS = 15 * 60_000;
const STORE_KEY = 'ec_med_alert_quiet';

type Quiet = Record<string, number>; // reminder id -> quiet until (ms since epoch; Infinity-like for taken)
const FOREVER = 8.64e15;

function readQuiet(): Quiet {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Quiet) : {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}
function writeQuiet(q: Quiet) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(q));
  } catch {
    /* private mode: the in-memory copy still works for this visit */
  }
}

/** Web's answer to mobile's real scheduled-notification medicine alarm — this
 *  app has no reliable way to alert the elder while the tab/app is fully
 *  closed (same "no Web Push token collection yet" gap documented in
 *  components/reminder-alerts.tsx), so this polls GET /api/v1/health/reminders
 *  (already self-healing/idempotent, generates today's reminders on read)
 *  while the elder's tab is open, and plays an actual beep — not just the
 *  spoken TTS reminder-alerts.tsx uses — the moment a reminder's scheduledAt
 *  has passed and it's still pending. Mount next to ReminderAlerts, same
 *  elder-only gating. */
export function MedicineAlerts() {
  const [queue, setQueue] = useState<DueMedicationReminder[]>([]);
  const [notice, setNotice] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepsRef = useRef<Record<string, { count: number; last: number }>>({});
  const quietRef = useRef<Quiet>({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    quietRef.current = readQuiet();

    async function poll() {
      try {
        const res = await fetch('/api/v1/health/reminders', { credentials: 'include' });
        const json = await res.json();
        if (cancelled || !json.success) return;

        const now = Date.now();
        quietRef.current = readQuiet();
        const due: DueMedicationReminder[] = (json.data as DueMedicationReminder[]).filter(
          (r) => r.status === 'pending' && new Date(r.scheduledAt).getTime() <= now && !(quietRef.current[r.id] > now),
        );

        const toBeep = due.filter((r) => {
          const seen = beepsRef.current[r.id];
          if (!seen) return true;
          return seen.count < MAX_BEEPS && now - seen.last >= RE_BEEP_MS;
        });
        if (toBeep.length > 0) {
          playMedicineBeep();
          speak(`Time for your medicine: ${toBeep.map((r) => r.medication.name).join(', ')}`);
          toBeep.forEach((r) => {
            const seen = beepsRef.current[r.id];
            beepsRef.current[r.id] = { count: (seen?.count ?? 0) + 1, last: now };
          });
        }

        // Keep the queue in sync with what is actually still due and pending — including when
        // nothing is: a dose confirmed elsewhere (the Health page's "Confirm taken") must
        // clear its banner here too, not leave it on screen.
        setQueue(due);
      } catch {
        // Silent — the next poll retries.
      }
    }

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function quiet(id: string, forMs: number) {
    quietRef.current = { ...readQuiet(), [id]: forMs >= FOREVER ? FOREVER : Date.now() + forMs };
    writeQuiet(quietRef.current);
    setQueue((q) => q.filter((r) => r.id !== id));
  }

  async function act(id: string, status: 'taken' | 'snoozed') {
    setActingId(id);
    setNotice('');
    // Answer straight away on screen; the save follows. The person has done what was asked.
    quiet(id, status === 'taken' ? FOREVER : SNOOZE_MS);
    try {
      const res = await fetch(`/api/v1/health/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('not saved');
    } catch {
      // Not saved: stay quiet for a while, then ask again, and say so plainly.
      quiet(id, SNOOZE_MS);
      setNotice(
        status === 'taken'
          ? 'We could not save that just now. We will remind you again in 15 minutes.'
          : 'We could not save the snooze, but we will ask again in 15 minutes.',
      );
      window.setTimeout(() => setNotice(''), 8000);
    } finally {
      setActingId(null);
    }
  }

  if (queue.length === 0 && !notice) return null;

  return (
    // Bottom-anchored, not top — components/reminder-alerts.tsx already owns
    // the top of the screen for voice-created reminders; both can be due at
    // once and shouldn't visually collide. bottom-20 on mobile clears the
    // fixed bottom tab bar (app-shell.tsx, z-40, md:hidden) the same way
    // VoiceAssistant's own floating button already does.
    <div className="fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 p-3 md:bottom-4">
      {notice && (
        <p role="status" className="w-full max-w-md rounded-xl border border-accent-100 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-900 shadow-lg">
          {notice}
        </p>
      )}
      {queue.map((r) => (
        <div
          key={r.id}
          className="flex w-full max-w-md flex-col gap-2 rounded-2xl border-2 border-danger-600 bg-surface px-4 py-3 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50">
              <Pill className="h-5 w-5 text-danger-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-text">{r.medication.name} — {r.medication.dosage}</p>
              {r.medication.instructions && <p className="truncate text-xs text-text-secondary">{r.medication.instructions}</p>}
            </div>
            <button
              onClick={() => quiet(r.id, HIDE_MS)}
              aria-label="Hide for now"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-primary-50 hover:text-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => act(r.id, 'taken')}
              disabled={actingId === r.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Taken
            </button>
            <button
              onClick={() => act(r.id, 'snoozed')}
              disabled={actingId === r.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-text disabled:opacity-60"
            >
              <Clock className="h-4 w-4" /> Snooze
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
