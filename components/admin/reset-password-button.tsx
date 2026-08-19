'use client';

import { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** For accounts with no email on file, "forgot password" (which emails a link)
 *  isn't reachable — this generates the same reset link and hands it to the admin
 *  to relay by phone/WhatsApp instead of emailing it. */
export function ResetPasswordButton({ userId, claimed }: { userId: string; claimed: boolean }) {
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!claimed) {
    return <span className="text-xs text-text-secondary">Not yet claimed</span>;
  }

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not generate a reset link.');
      setResetUrl(json.data.resetUrl);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a reset link.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!resetUrl) return;
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (resetUrl) {
    return (
      <div className="flex items-center gap-2">
        <code className="max-w-[180px] truncate rounded bg-primary-50 px-2 py-1 text-xs text-primary-900">{resetUrl}</code>
        <Button type="button" size="sm" variant="outline" onClick={copyLink}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="outline" onClick={generate} disabled={loading}>
        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
        {loading ? 'Generating...' : 'Reset password'}
      </Button>
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}
