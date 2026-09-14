'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X, MessageCircle, MapPin } from 'lucide-react';
import { playSirenAlert } from '@/lib/beep';
import { buildWaLink } from '@/lib/whatsapp';

interface SosEvent {
  id: string;
  triggerType: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  user: { id: string; name: string; phone: string | null };
}

const POLL_MS = 25_000;
const RE_ALERT_MS = 45_000; // re-siren this often while something is still unacknowledged
const ACTIVE_WINDOW_MS = 15 * 60_000; // only alert on events from the last 15 minutes

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'SOS alert',
  ambulance: 'Ambulance called',
  police: 'Police called',
  community_panic: 'Panic alert',
};

/** Dismissal is persisted to localStorage (not just component state) so it
 *  survives a remount — navigating between top-level sections (e.g.
 *  /family to /community, each its own layout.tsx) unmounts this component,
 *  and an in-memory-only Set would forget the dismissal and siren again for
 *  the same event on the next mount. Keyed per source since family/committee
 *  event ids never collide, but this keeps the two feeds' storage separate
 *  regardless. Entries are pruned to ACTIVE_WINDOW_MS on read/write so this
 *  never grows unbounded — an event outside that window is never alerted on
 *  again anyway (see the `active` filter below), dismissed or not. */
function loadDismissed(source: string): Map<string, number> {
  try {
    const raw = localStorage.getItem(`ec_sos_dismissed_${source}`);
    const parsed: Array<[string, number]> = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    return new Map(parsed.filter(([, dismissedAt]) => dismissedAt > cutoff));
  } catch {
    return new Map();
  }
}

function saveDismissed(source: string, dismissed: Map<string, number>) {
  try {
    localStorage.setItem(`ec_sos_dismissed_${source}`, JSON.stringify([...dismissed.entries()]));
  } catch {
    // Private browsing / storage disabled — dismissal just won't survive a
    // remount this session, same as before this fix.
  }
}

/** Live SOS/panic alert: polls for new events and, when one is active and
 *  unacknowledged, plays a loud siren (Web Audio, see lib/beep.ts),
 *  vibrates on devices that support it, and shows a banner with a Google
 *  Maps link and a WhatsApp button to check on the person — while this tab
 *  is open. There's no way to alert a closed tab/browser from the web (see
 *  the conversation this was built from); this is the foreground
 *  equivalent of a push notification, not a replacement for one.
 *
 *  `source: 'family'` polls every elder the caregiver is linked to
 *  (GET /family/sos-feed). `source: 'committee'` first checks whether the
 *  caller is committee/admin in any community (GET /community/me) — most
 *  viewers aren't, and GET /community/panic 403s for non-managers, so this
 *  avoids polling a route that would just fail for them — and only then
 *  polls GET /community/panic. */
export function SosAlertBanner({ source }: { source: 'family' | 'committee' }) {
  const [eligible, setEligible] = useState(source === 'family');
  const [events, setEvents] = useState<SosEvent[]>([]);
  // Lazy initializer so this reads localStorage exactly once, synchronously,
  // before the first render's `active` filter runs — otherwise a dismissed
  // event still sirens for one tick every remount before the effect below
  // could load it.
  const [dismissed, setDismissed] = useState<Map<string, number>>(() => loadDismissed(source));
  const lastAlertedRef = useRef<{ id: string | null; at: number }>({ id: null, at: 0 });

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Map(prev).set(id, Date.now());
      saveDismissed(source, next);
      return next;
    });
  }

  // Committee eligibility check — once, not on every poll.
  useEffect(() => {
    if (source !== 'committee') return;
    let cancelled = false;
    fetch('/api/v1/community/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.success) return;
        const isManager = (j.data?.memberships ?? []).some(
          (m: { role: string }) => m.role === 'committee' || m.role === 'admin',
        );
        setEligible(isManager);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    if (!eligible) return;
    const url = source === 'family' ? '/api/v1/family/sos-feed' : '/api/v1/community/panic';

    async function poll() {
      try {
        const res = await fetch(url, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setEvents(json.data ?? []);
      } catch {
        // Best-effort — try again next tick.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [eligible, source]);

  const active = events.filter(
    (e) => !dismissed.has(e.id) && Date.now() - new Date(e.createdAt).getTime() < ACTIVE_WINDOW_MS,
  );
  const latest = active[0];

  useEffect(() => {
    if (!latest) return;
    const { id, at } = lastAlertedRef.current;
    const isNew = id !== latest.id;
    const dueForReAlert = Date.now() - at > RE_ALERT_MS;
    if (isNew || dueForReAlert) {
      playSirenAlert();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 150, 300, 150, 600]);
      }
      lastAlertedRef.current = { id: latest.id, at: Date.now() };
    }
  }, [latest, events]); // eslint-disable-line react-hooks/exhaustive-deps -- fires on the re-alert timer via `events` re-polling, not just when `latest` identity changes

  if (!latest) return null;

  const mapsLink = latest.lat != null && latest.lng != null ? `https://www.google.com/maps?q=${latest.lat},${latest.lng}` : null;
  const waLink = latest.user.phone
    ? buildWaLink(latest.user.phone, `Are you OK? I saw your ${TRIGGER_LABEL[latest.triggerType] ?? 'alert'} on EC.`)
    : null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3">
      <div className="flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-danger-200 bg-danger-50 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-600 text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-danger-900">
              {TRIGGER_LABEL[latest.triggerType] ?? 'Emergency alert'} — {latest.user.name}
            </p>
            <p className="text-sm text-danger-900/80">
              {new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={() => dismiss(latest.id)}
            aria-label="Dismiss alert"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger-900/60 hover:bg-danger-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-danger-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              <MapPin className="h-4 w-4" />
              View location
            </a>
          )}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-sm font-semibold text-success-600"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp {latest.user.name}
            </a>
          )}
        </div>
        {active.length > 1 && (
          <p className="text-xs text-danger-900/70">+{active.length - 1} more unacknowledged alert{active.length - 1 > 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
}
