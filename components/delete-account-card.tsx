'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';

/** "Delete my account" on every profile page. Opens in two steps so it can't be done by a stray tap:
 *  first what will happen, then the word DELETE (and the password, when the account has one). On success
 *  the person is signed out and sent to the sign-in page. The same wording is on the public page at
 *  /delete-account, which is the link given to Google Play. */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm, password: password || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'We could not delete the account. Please try again.');
      // Signed out by the server; the sign-in page also tells the phone app to forget this account.
      window.location.href = '/login?deleted=1';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not delete the account. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 border-danger-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger-900">
          <Trash2 className="h-5 w-5 text-danger-600" />
          Delete my account
        </CardTitle>
        <CardDescription>
          Permanently remove your account and the personal information in it. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
            I want to delete my account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="flex flex-col gap-4">
            <div className="rounded-xl bg-danger-50 p-4 text-sm text-danger-900">
              <p className="font-semibold">This will delete, straight away:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>your name, phone, email, address, date of birth, photo, password and PIN</li>
                <li>your medicines, reminders, prescriptions, appointments, health notes and SOS history</li>
                <li>your contacts, memories, voice history and family links</li>
                <li>your community membership, and the messages and listings you posted</li>
              </ul>
              <p className="mt-3">
                Records of orders and payments are kept without your name, as the law requires.{' '}
                <Link href="/delete-account" className="underline">Read the full details</Link>.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="del-password">Your password</Label>
              <PasswordInput
                id="del-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <p className="text-xs text-text-secondary">
                Leave this empty if you sign in only with a WhatsApp code or a PIN.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="del-confirm">Type DELETE to confirm</Label>
              <Input
                id="del-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-danger-600">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" size="lg" disabled={busy || confirm !== 'DELETE'}>
                {busy ? 'Deleting...' : 'Delete my account for ever'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)} disabled={busy}>
                Keep my account
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
