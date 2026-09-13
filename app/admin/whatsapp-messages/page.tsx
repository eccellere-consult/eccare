'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, RotateCcw, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Template {
  key: string;
  label: string;
  description: string;
  defaultBody: string;
  body: string;
  isCustomized: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** Every pre-filled WhatsApp message in the app (registration invites, auto
 *  booking requests, doctor booking confirmations, the emergency Police
 *  alert) reads its text from here — see lib/whatsapp-templates.ts for the
 *  fixed key/default list, and GET /api/v1/whatsapp-templates for how each
 *  page actually fetches the current wording. Editing here changes what
 *  every elder/caregiver sends going forward; it never resends anything
 *  already sent. */
export default function AdminWhatsAppMessagesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    fetch('/api/v1/admin/whatsapp-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setTemplates(j.data);
          setDrafts(Object.fromEntries(j.data.map((t: Template) => [t.key, t.body])));
        } else {
          setError(j.error?.message || 'Could not load message templates.');
        }
      })
      .catch(() => setError('Could not load message templates.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setSavingKey(key);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/whatsapp-templates/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: drafts[key] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not save.');
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingKey(null);
    }
  }

  async function resetToDefault(t: Template) {
    if (!confirm(`Reset "${t.label}" to its default wording?`)) return;
    setSavingKey(t.key);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/whatsapp-templates/${t.key}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not reset.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
        <MessageCircle className="h-6 w-6 text-primary-600" />
        WhatsApp messages
      </h1>
      <p className="mt-1 text-text-secondary">
        Edit the wording of every message EC pre-fills into WhatsApp. Changes apply to every new message sent from that point on.
      </p>

      {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}

      {!templates ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {templates.map((t) => {
            const draft = drafts[t.key] ?? '';
            const dirty = draft !== t.body;
            return (
              <Card key={t.key}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-text">{t.label}</p>
                      <p className="mt-1 text-sm text-text-secondary">{t.description}</p>
                    </div>
                    {t.isCustomized ? (
                      <span className="shrink-0 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-900">
                        Customized{t.updatedByName ? ` by ${t.updatedByName}` : ''}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-900">Default</span>
                    )}
                  </div>

                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [t.key]: e.target.value }))}
                    rows={draft.split('\n').length + 1}
                    className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={!dirty || savingKey === t.key} onClick={() => save(t.key)}>
                      {savingKey === t.key ? 'Saving…' : savedKey === t.key ? (<><Check className="h-4 w-4" /> Saved</>) : 'Save'}
                    </Button>
                    {dirty && (
                      <Button size="sm" variant="outline" onClick={() => setDrafts((d) => ({ ...d, [t.key]: t.body }))}>
                        Discard changes
                      </Button>
                    )}
                    {t.isCustomized && (
                      <Button size="sm" variant="outline" disabled={savingKey === t.key} onClick={() => resetToDefault(t)}>
                        <RotateCcw className="h-4 w-4" /> Reset to default
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
