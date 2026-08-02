'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Languages } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

interface ElderSettings {
  name: string;
  language: string;
  secondaryLanguage: string | null;
}

export default function ElderLanguageSettingsPage({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = use(params);

  const [elder, setElder] = useState<ElderSettings | null>(null);
  const [language, setLanguage] = useState('en');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/family/elder/${elderId}/settings`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setElder(j.data);
          setLanguage(j.data.language ?? 'en');
          setSecondaryLanguage(j.data.secondaryLanguage ?? '');
        } else {
          setError(j.error?.message || 'Could not load this elder.');
        }
      })
      .catch(() => setError('Could not load this elder.'))
      .finally(() => setLoading(false));
  }, [elderId]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/family/elder/${elderId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, secondaryLanguage }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not save.');
      setElder(json.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  if (!elder) {
    return <p className="text-danger-600">{error || 'Could not load this elder.'}</p>;
  }

  return (
    <div>
      <Link href="/family" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text">
        <ArrowLeft className="h-4 w-4" />
        Back to Family
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-text">{elder.name}&rsquo;s language</h1>
      <p className="mt-1 text-text-secondary">
        Choose the two languages {elder.name} can switch between. A toggle will appear on their Home and
        Health pages.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary-600" />
            Language pair
          </CardTitle>
          <CardDescription>
            AI-translated text — recommend a native speaker double-check it if this is important to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Primary (currently active)</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondaryLanguage">Second language</Label>
            <select
              id="secondaryLanguage"
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
            >
              <option value="" disabled>
                Choose a second language
              </option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={l.code === language}>
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}
          {saved && <p className="text-sm font-semibold text-success-600">Saved.</p>}

          <Button
            onClick={handleSave}
            disabled={saving || !secondaryLanguage || secondaryLanguage === language}
            className="self-start"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
