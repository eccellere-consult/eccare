'use client';

import { useEffect, useState } from 'react';
import { Loader2, PlayCircle } from 'lucide-react';

interface Persona {
  id: 'elder' | 'family' | 'provider';
  label: string;
  name: string;
  blurb: string;
  avatar: string;
}

/** "Try the demo" on the sign-in page: one tap signs in as a sample elder, family member or
 *  service provider — no password, nothing to type. Only shown while the demo is loaded.
 *  The sample data is read-only, so a visitor can explore freely without spoiling anything. */
export function DemoSignIn({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/demo/logins')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.data?.available) setPersonas(j.data.personas as Persona[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function start(persona: Persona) {
    setBusy(persona.id);
    setError('');
    try {
      const res = await fetch('/api/v1/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ persona: persona.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not start the demo.');
      onSuccess(json.data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo.');
      setBusy(null);
    }
  }

  if (personas.length === 0) return null;

  return (
    <section aria-labelledby="demo-heading" className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 p-4">
      <h2 id="demo-heading" className="flex items-center gap-2 text-base font-bold text-primary-900">
        <PlayCircle className="h-5 w-5 text-primary-600" />
        Just looking? Try the demo
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Tap one to start straight away — no sign-up and no password. Everything you see is sample data.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {personas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => start(p)}
            disabled={busy !== null}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 disabled:opacity-60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full bg-primary-50 object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-primary-600">{p.label}</span>
              <span className="block truncate font-bold text-text">{p.name}</span>
              <span className="block truncate text-xs text-text-secondary">{p.blurb}</span>
            </span>
            {busy === p.id ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600" /> : null}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </section>
  );
}
