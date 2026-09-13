'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

/** Self-contained change-password form, reused across every role's profile page.
 *  Translated (via a defensive useLanguage() fallback to English) only shows up
 *  on the elder side, since only /elder/* wraps in LanguageProvider. */
export function ChangePasswordCard() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (newPassword.length < 8) {
      setError(t('shared.changePassword.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('shared.changePassword.mismatch'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('shared.changePassword.couldNotChange'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shared.changePassword.couldNotChange'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary-600" />
          {t('shared.changePassword.title')}
        </CardTitle>
        <CardDescription>{t('shared.changePassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">{t('shared.changePassword.current')}</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">{t('shared.changePassword.new')}</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">{t('shared.changePassword.confirm')}</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          {saved && !error && <p className="text-sm text-success-600">{t('shared.changePassword.changed')}</p>}
          <Button type="submit" disabled={busy || !currentPassword || !newPassword} className="self-start">
            {busy ? t('shared.changePassword.saving') : t('shared.changePassword.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
