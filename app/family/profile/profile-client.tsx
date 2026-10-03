'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/change-password-card';
import { ProfileDobField } from '@/components/profile-dob';
import { checkDateOfBirth, DOB_ERROR_MESSAGES } from '@/lib/age';
import { isValidEmail, isValidAnyPhone, EMAIL_FORMAT_MESSAGE, ANY_PHONE_FORMAT_MESSAGE } from '@/lib/validation';

interface Profile {
  name: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export function FamilyProfileClient({ profile }: { profile: Profile }) {
  const [form, setForm] = useState(profile);
  // Only a date entered now is new; one already on record is locked and not resent.
  const [newDob, setNewDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (!profile.dateOfBirth && newDob) {
      const check = checkDateOfBirth(newDob);
      if (!check.ok) {
        setMessage(DOB_ERROR_MESSAGES[check.reason]);
        return;
      }
    }
    if (form.email && !isValidEmail(form.email)) {
      setMessage(EMAIL_FORMAT_MESSAGE);
      return;
    }
    if (form.phone && !isValidAnyPhone(form.phone)) {
      setMessage(ANY_PHONE_FORMAT_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dateOfBirth: profile.dateOfBirth ? undefined : newDob || undefined }),
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
      <p className="mt-1 text-text-secondary">Kept up to date so the elders you care for can reach you.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Kept up to date so the elders you care for can reach you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <ProfileDobField
              locked={profile.dateOfBirth}
              value={newDob}
              onChange={setNewDob}
              labels={{
                label: 'Date of birth',
                day: 'Day',
                month: 'Month',
                year: 'Year',
                locked: 'Your date of birth is on record. Only an admin can change it.',
                addPrompt: 'Add your date of birth — it sets up the right account features for you.',
              }}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-phone">Phone number</Label>
              <Input id="p-phone" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-city">City</Label>
                <Input id="p-city" value={form.city ?? ''} onChange={(e) => update('city', e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-pincode">Pincode</Label>
                <Input id="p-pincode" value={form.pincode ?? ''} onChange={(e) => update('pincode', e.target.value)} />
              </div>
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
