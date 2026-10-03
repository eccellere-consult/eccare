'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Rendered by app/family/layout.tsx in place of the family portal when the age
 *  rule locks the caregiver out: their date of birth is 60 or over and no admin
 *  has granted an exception. A hard block, like the expired-subscription gate.
 *  The two ways forward are real: become the elder account their age says they
 *  are, or ask an admin for an exception (e.g. a 63-year-old son looking after
 *  his 88-year-old mother). */
export function CaregiverAgeGate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function switchToElder() {
    if (!confirm('Switch this account to an Elder account? You will no longer see the family-member screens.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/switch-to-elder', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not switch the account.');
      router.push('/elder');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch the account.');
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <CardContent className="flex flex-col gap-4 pt-6">
        <h1 className="text-xl font-bold text-text">Family-member features are for people under 60</h1>
        <p className="text-text-secondary">
          Your date of birth makes you 60 or over, which EC treats as an Elder account. Family-member features
          (managing an elder&rsquo;s health, orders, payments and so on) are only available to people under 60.
        </p>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border p-4">
            <p className="font-semibold text-text">Use EC as an elder</p>
            <p className="mt-1 text-sm text-text-secondary">
              Switch this account to an Elder account — the large-button home, SOS, medicines and community.
            </p>
            <Button className="mt-3" onClick={switchToElder} disabled={busy}>
              {busy ? 'Switching…' : 'Switch to an Elder account'}
            </Button>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="font-semibold text-text">Looking after a family member?</p>
            <p className="mt-1 text-sm text-text-secondary">
              If you care for someone and are 60 or over, ask EC support to allow family-member features on your
              account. Once an admin approves, this screen goes away on its own.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
