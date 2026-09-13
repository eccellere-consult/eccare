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
// the day. Matches mobile's repeating-alarm feel without literally looping
// audio in a background tab (browsers throttle/kill that anyway).
const RE_BEEP_MS = 5 * 60_000;

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBeepedAtRef = useRef<Record<string, number>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/v1/health/reminders', { credentials: 'include' });
        const json = await res.json();
        if (cancelled || !json.success) return;

        const now = Date.now();
        const due: DueMedicationReminder[] = (json.data as DueMedicationReminder[]).filter(
          (r) => r.status === 'pending' && new Date(r.scheduledAt).getTime() <= now,
        );
        if (due.length === 0) return;

        const newlyDue = due.filter((r) => !(r.id in lastBeepedAtRef.current));
        const dueForReBeep = due.filter((r) => {
          const last = lastBeepedAtRef.current[r.id];
          return last !== undefined && now - last >= RE_BEEP_MS;
        });
        const toBeep = [...newlyDue, ...dueForReBeep];

        if (toBeep.length > 0) {
          playMedicineBeep();
          const names = toBeep.map((r) => r.medication.name).join(', ');
          speak(`Time for your medicine: ${names}`);
          toBeep.forEach((r) => { lastBeepedAtRef.current[r.id] = now; });
        }

        // Keep the queue in sync with what's actually still due+pending —
        // an item taken/snoozed elsewhere (e.g. the Health page) drops out
        // on the next poll instead of lingering as a stale banner.
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

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  function hide(id: string) {
    setHiddenIds((prev) => new Set(prev).add(id));
  }

  async function act(id: string, status: 'taken' | 'snoozed') {
    setActingId(id);
    try {
      const res = await fetch(`/api/v1/health/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setQueue((q) => q.filter((r) => r.id !== id));
        delete lastBeepedAtRef.current[id];
      }
    } finally {
      setActingId(null);
    }
  }

  const visible = queue.filter((r) => !hiddenIds.has(r.id));
  if (visible.length === 0) return null;

  return (
    // Bottom-anchored, not top — components/reminder-alerts.tsx already owns
    // the top of the screen for voice-created reminders; both can be due at
    // once and shouldn't visually collide. bottom-20 on mobile clears the
    // fixed bottom tab bar (app-shell.tsx, z-40, md:hidden) the same way
    // VoiceAssistant's own floating button already does.
    <div className="fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 p-3 md:bottom-4">
      {visible.map((r) => (
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
              onClick={() => hide(r.id)}
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
