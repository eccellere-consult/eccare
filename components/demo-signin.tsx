'use client';

import { useEffect, useState } from 'react';
import { Loader2, PlayCircle } from 'lucide-react';

interface Persona {
  id: 'elder';
  label: string;
  name: string;
  blurb: string;
  avatar: string;
}

/** Signs in as the demo elder with no password. Shared by the sign-in page's "Try the demo" link
 *  and the shareable /demo page. Returns the role to send the person home with. */
export async function startElderDemo(): Promise<string> {
  const res = await fetch('/api/v1/demo/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ persona: 'elder' }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not start the demo.');
  return json.data.user.role as string;
}

/** The one "Try the demo" link on the sign-in page: a single tap signs in as the sample elder —
 *  no sign-up, no password. Only shown while the demo is loaded. The sample data is read-only, so
 *  a visitor can explore freely without spoiling anything. */
export function DemoSignIn({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/demo/logins')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.data?.available && j.data.personas?.[0]) setPersona(j.data.personas[0] as Persona);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    setBusy(true);
    setError('');
    try {
      onSuccess(await startElderDemo());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo.');
      setBusy(false);
    }
  }

  if (!persona) return null;

  return (
    <section aria-labelledby="demo-heading" className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 p-4">
      <h2 id="demo-heading" className="flex items-center gap-2 text-base font-bold text-primary-900">
        <PlayCircle className="h-5 w-5 text-primary-600" />
        Just looking? Try the demo
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Tap below to start straight away — no sign-up and no password. Everything you see is sample data.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 disabled:opacity-60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={persona.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full bg-primary-50 object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-primary-600">Start as an elder</span>
          <span className="block truncate font-bold text-text">{persona.name}</span>
          <span className="block truncate text-xs text-text-secondary">{persona.blurb}</span>
        </span>
        {busy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600" /> : null}
      </button>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </section>
  );
}
