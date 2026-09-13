'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/change-password-card';
import { isValidEmail, isValidPhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Profile {
  name: string;
  email: string | null;
  phone: string | null;
  bloodGroup: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export function ProfileClient({ profile }: { profile: Profile }) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
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
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('elder.profile.couldNotSave'));
      setMessage(t('elder.profile.saved'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('elder.profile.couldNotSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-text">{t('elder.profile.title')}</h1>
      <p className="mt-1 text-text-secondary">{t('elder.profile.subtitle')}</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('elder.profile.detailsCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-name">{t('elder.profile.name')}</Label>
              <Input id="p-name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-phone">{t('elder.profile.phoneNumber')}</Label>
              <Input id="p-phone" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-email">{t('elder.profile.email')}</Label>
              <Input id="p-email" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-blood">{t('elder.profile.bloodGroup')}</Label>
              <Input id="p-blood" value={form.bloodGroup ?? ''} onChange={(e) => update('bloodGroup', e.target.value)} placeholder="O+" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-address">{t('elder.profile.address')}</Label>
              <Input id="p-address" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-city">{t('elder.profile.city')}</Label>
                <Input id="p-city" value={form.city ?? ''} onChange={(e) => update('city', e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-pincode">{t('elder.profile.pincode')}</Label>
                <Input id="p-pincode" value={form.pincode ?? ''} onChange={(e) => update('pincode', e.target.value)} />
              </div>
            </div>
            {message && <p className="text-sm text-text-secondary">{message}</p>}
            <Button type="submit" disabled={saving} size="lg">
              {saving ? t('elder.profile.saving') : t('elder.profile.saveChanges')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6">
        <ChangePasswordCard />
      </div>

      <Link href="/elder/sos-history" className="mt-4 block">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-50">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">{t('elder.profile.mySosHistory')}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
