'use client';

import { useState } from 'react';
import { Power } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FeatureKey } from '@/lib/feature-switches-shared';

/**
 * The On/Off launch switch of one feature, shown at the top of that feature's admin page.
 * Off: nobody outside admin sees the feature. Turning it On asks for a confirmation first.
 */
export function FeatureSwitchCard({
  featureKey,
  title,
  whenOn,
  initialOn,
}: {
  featureKey: FeatureKey;
  title: string;
  /** What people will see once it is On, in one plain sentence. */
  whenOn: string;
  initialOn: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    const next = !on;
    const ok = window.confirm(
      next ? `Switch ${title} ON?\n\n${whenOn}` : `Switch ${title} OFF? People will stop seeing it at once. Nothing is deleted.`,
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/features', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: featureKey, enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not change the switch.');
      setOn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the switch.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={on ? 'border-success-600' : 'border-accent-100 bg-accent-50'}>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
        <Power className={`h-6 w-6 shrink-0 ${on ? 'text-success-600' : 'text-accent-600'}`} />
        <div className="flex-1">
          <p className="flex items-center gap-2 font-bold text-text">
            {title} <Badge variant={on ? 'success' : 'muted'}>{on ? 'On' : 'Off'}</Badge>
          </p>
          <p className="text-sm text-text-secondary">
            {on ? whenOn : 'Off: only admins can see this. Review and set up first, then switch On on launch day.'}
          </p>
          {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
        </div>
        <Button variant={on ? 'outline' : 'primary'} onClick={toggle} disabled={busy}>
          {busy ? 'Saving…' : on ? 'Switch Off' : 'Switch On'}
        </Button>
      </CardContent>
    </Card>
  );
}
