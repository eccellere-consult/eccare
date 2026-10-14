'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { startElderDemo } from '@/components/demo-signin';

type Phase = 'checking' | 'starting' | 'confirm' | 'unavailable' | 'error';

/** The shareable demo link (eccare.in/demo). Opening it signs in as the sample elder and goes
 *  straight to the home screen — no password, nothing to type. It starts by itself in the
 *  browser, so link previews in WhatsApp or e-mail never sign anyone in. If the visitor is
 *  already signed in to a real account, it asks first rather than replacing that session. */
export default function DemoLinkPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');
  const [who, setWho] = useState('');
  const [message, setMessage] = useState('');

  const start = useCallback(async () => {
    setPhase('starting');
    try {
      await startElderDemo();
      router.replace('/elder');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not start the demo.');
      setPhase('error');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const logins = await (await fetch('/api/v1/demo/logins')).json();
        if (cancelled) return;
        if (!logins?.data?.available) {
          setPhase('unavailable');
          return;
        }
        const status = await fetch('/api/v1/demo/status', { credentials: 'include' });
        if (cancelled) return;
        if (status.status === 401) return void start(); // not signed in: just start
        const json = await status.json();
        if (json?.data?.demoAccount) return void start(); // already in a demo session
        const me = await (await fetch('/api/v1/auth/me', { credentials: 'include' })).json().catch(() => null);
        if (cancelled) return;
        setWho(me?.data?.name ?? 'another account');
        setPhase('confirm');
      } catch {
        if (!cancelled) setPhase('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-black text-primary-600">EC</h1>
        <p className="mt-1 text-text-secondary">Just Easy.</p>

        <Card className="mt-6 text-left">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            {(phase === 'checking' || phase === 'starting') && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                <p className="text-lg font-bold text-text">Starting your demo…</p>
                <p className="text-sm text-text-secondary">You will see how an elder uses EC. Everything here is sample data.</p>
              </>
            )}

            {phase === 'confirm' && (
              <>
                <p className="text-lg font-bold text-text">You are signed in as {who}</p>
                <p className="text-sm text-text-secondary">Starting the demo will sign you out of that account in this browser.</p>
                <Button size="lg" className="w-full" onClick={start}>Start the demo anyway</Button>
                <Link href="/login" className="text-sm font-semibold text-primary-600 hover:underline">Go back without changing anything</Link>
              </>
            )}

            {phase === 'unavailable' && (
              <>
                <p className="text-lg font-bold text-text">The demo is not available right now</p>
                <p className="text-sm text-text-secondary">Please try again a little later.</p>
                <Link href="/login" className="text-sm font-semibold text-primary-600 hover:underline">Go to sign in</Link>
              </>
            )}

            {phase === 'error' && (
              <>
                <p className="text-lg font-bold text-text">We could not start the demo</p>
                <p className="text-sm text-danger-600">{message}</p>
                <Button size="lg" className="w-full" onClick={start}>Try again</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
