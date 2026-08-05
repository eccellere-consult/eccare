'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/change-password-card';

interface Profile {
  name: string;
  email: string | null;
  phone: string | null;
}

export function AdminProfileClient({ profile }: { profile: Profile }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
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
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-text">Your profile</h1>
      <p className="mt-1 text-text-secondary">Your EC admin account details.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Phone: {profile.phone ?? 'not set'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
            </div>
            {message && <p className="text-sm text-text-secondary">{message}</p>}
            <Button type="submit" disabled={saving} size="lg">
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6">
        <ChangePasswordCard />
      </div>
    </div>
  );
}
