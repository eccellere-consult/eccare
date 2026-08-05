'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/change-password-card';
import { isValidEmail, isValidPhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';

interface Account {
  name: string;
  email: string | null;
  phone: string | null;
}

/**
 * The underlying User account's own name/email/phone + password — distinct from
 * ProviderProfileClient, which edits the ServiceProvider business entity
 * (businessName/category/description/serviceArea/phone/address).
 */
export function ProviderAccountClient({ initial }: { initial: Account }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update<K extends keyof Account>(key: K, value: Account[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (form.email && !isValidEmail(form.email)) {
      setMessage(EMAIL_FORMAT_MESSAGE);
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setMessage(PHONE_FORMAT_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not save changes.');
      setMessage('Saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-bold text-text">Your account</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="acc-name">Your name</Label>
                <Input id="acc-name" value={form.name} onChange={(e) => update('name', e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="acc-phone">Your phone</Label>
                <Input id="acc-phone" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-email">Your email</Label>
              <Input id="acc-email" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            {message && <p className="text-sm text-text-secondary">{message}</p>}
            <Button type="submit" disabled={saving} className="self-start">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
