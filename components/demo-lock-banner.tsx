'use client';

import { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';

interface DemoState {
  demoAccount: boolean;
  locked: boolean;
  unlockedUntil: string | null;
}

/** A short notice on the demo logins: the sample data is read-only until an admin unlocks it.
 *  Renders nothing for everyone else (and if the check fails). */
export function DemoLockBanner() {
  const [state, setState] = useState<DemoState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/demo/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setState(json.data as DemoState);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state?.demoAccount) return null;

  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${
        state.locked ? 'border-border bg-primary-50 text-primary-900' : 'border-accent-100 bg-accent-50 text-accent-900'
      }`}
    >
      {state.locked ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <LockOpen className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>
        {state.locked
          ? 'Demo account — the sample data here is read-only. Ask an admin to unlock it if you need to make changes.'
          : `Demo account — editing is unlocked until ${new Date(state.unlockedUntil!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}
      </span>
    </div>
  );
}
