'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, RotateCcw, Check, Languages, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

interface LanguageVersion {
  body: string;
  defaultBody: string;
  isCustomized: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}
interface Template {
  key: string;
  label: string;
  description: string;
  languages: Record<string, LanguageVersion>;
}

/** Every pre-filled WhatsApp message in the app (registration invites, auto
 *  booking requests, doctor booking confirmations, the emergency alert) reads
 *  its text from here — see lib/whatsapp-templates.ts for the fixed key/default
 *  list, and GET /api/v1/whatsapp-templates for how each page actually fetches
 *  the current wording. Each message exists in every supported language; a
 *  language nobody has edited uses a built-in translated default. Editing here
 *  changes what gets sent from then on; it never resends anything already sent. */
export default function AdminWhatsAppMessagesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [lang, setLang] = useState('en');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // English edits can also refresh the other languages in the same click.
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);

  const draftId = (key: string, l: string) => `${key}:${l}`;

  function load() {
    fetch('/api/v1/admin/whatsapp-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setTemplates(j.data);
          const next: Record<string, string> = {};
          for (const t of j.data as Template[]) {
            for (const [code, v] of Object.entries(t.languages)) next[draftId(t.key, code)] = v.body;
          }
          setDrafts(next);
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
    const id = draftId(key, lang);
    setSavingKey(id);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/whatsapp-templates/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: drafts[id], language: lang }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not save.');
      setSavedKey(id);
      setTimeout(() => setSavedKey(null), 2000);

      // The English wording just changed, so the other languages would now be
      // out of date — translate and save them too unless the admin opted out.
      if (lang === 'en' && autoTranslate) {
        setNotice('Saved. Translating into Hindi, Kannada and Malayalam…');
        try {
          const tr = await requestTranslation(key, undefined, true);
          setNotice(
            tr.failed.length === 0
              ? 'Saved, and translated into Hindi, Kannada and Malayalam. Check the other tabs to review them.'
              : `Saved. Could not translate ${tr.failed.map(langName).join(', ')} — use "Translate from English" on that tab to retry.`,
          );
        } catch (err) {
          // The English wording is saved either way; only the translation step failed.
          setNotice(`Saved in English. ${err instanceof Error ? err.message : 'Could not translate the other languages.'}`);
        }
      } else {
        setNotice('');
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingKey(null);
    }
  }

  async function resetToDefault(t: Template) {
    if (!confirm(`Reset "${t.label}" (${langName(lang)}) to its default wording?`)) return;
    const id = draftId(t.key, lang);
    setSavingKey(id);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/whatsapp-templates/${t.key}?lang=${lang}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not reset.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset.');
    } finally {
      setSavingKey(null);
    }
  }

  async function requestTranslation(key: string, languages: string[] | undefined, save: boolean) {
    const res = await fetch(`/api/v1/admin/whatsapp-templates/${key}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ languages, save }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not translate.');
    return json.data as { translations: Record<string, string>; failed: string[] };
  }

  /** Fills this language's box with a translation of the saved English wording,
   *  without saving — so it can be read and corrected before it goes live. */
  async function translateFromEnglish(t: Template) {
    const id = draftId(t.key, lang);
    setTranslatingKey(id);
    setError('');
    setNotice('');
    try {
      const { translations, failed } = await requestTranslation(t.key, [lang], false);
      if (failed.length > 0 || !translations[lang]) throw new Error(`Could not translate into ${langName(lang)}. Please try again.`);
      setDrafts((d) => ({ ...d, [id]: translations[lang] }));
      setNotice(`Translated into ${langName(lang)} from the saved English wording — read it, then press Save to use it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not translate.');
    } finally {
      setTranslatingKey(null);
    }
  }

  const langName = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
        <MessageCircle className="h-6 w-6 text-primary-600" />
        WhatsApp messages
      </h1>
      <p className="mt-1 text-text-secondary">
        Edit the wording of every message EC pre-fills into WhatsApp, in each language. Changes apply to every new
        message sent from that point on.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Message language">
        {SUPPORTED_LANGUAGES.map((l) => (
          <button
            key={l.code}
            role="tab"
            aria-selected={lang === l.code}
            onClick={() => setLang(l.code)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              lang === l.code
                ? 'border-primary-600 bg-primary-50 text-primary-900'
                : 'border-border text-text-secondary hover:border-primary-300',
            )}
          >
            {l.native}
          </button>
        ))}
      </div>
      {lang !== 'en' && (
        <p className="mt-3 rounded-xl bg-accent-50 p-3 text-sm text-accent-900">
          The built-in {langName(lang)} wording is AI-translated &mdash; please have a native speaker check it, and
          edit it here if anything reads wrong. Keep the <span className="font-mono">{'{{placeholders}}'}</span> exactly
          as they are.
        </p>
      )}

      {lang === 'en' && (
        <label className="mt-3 flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>
            When I save an English message, also translate it into Hindi, Kannada and Malayalam (replaces the
            saved wording in those languages — review them in their tabs afterwards).
          </span>
        </label>
      )}

      {notice && <p className="mt-4 rounded-xl bg-primary-50 p-3 text-sm text-primary-900">{notice}</p>}
      {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}

      {!templates ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {templates.map((t) => {
            const version = t.languages[lang];
            const id = draftId(t.key, lang);
            const draft = drafts[id] ?? '';
            const dirty = draft !== version.body;
            return (
              <Card key={t.key}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-text">{t.label}</p>
                      <p className="mt-1 text-sm text-text-secondary">{t.description}</p>
                    </div>
                    {version.isCustomized ? (
                      <span className="shrink-0 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-900">
                        Customized{version.updatedByName ? ` by ${version.updatedByName}` : ''}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-900">
                        {lang === 'en' ? 'Default' : 'Built-in translation'}
                      </span>
                    )}
                  </div>

                  {lang !== 'en' && t.languages.en.isCustomized && !version.isCustomized && (
                    <p className="rounded-xl bg-accent-50 p-3 text-sm text-accent-900">
                      The English wording was customised, but this language still shows the built-in wording. Use
                      &ldquo;Translate from English&rdquo; to bring it in line.
                    </p>
                  )}

                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                    rows={draft.split('\n').length + 1}
                    lang={lang}
                    className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={!dirty || savingKey === id} onClick={() => save(t.key)}>
                      {savingKey === id ? 'Saving…' : savedKey === id ? (<><Check className="h-4 w-4" /> Saved</>) : 'Save'}
                    </Button>
                    {dirty && (
                      <Button size="sm" variant="outline" onClick={() => setDrafts((d) => ({ ...d, [id]: version.body }))}>
                        Discard changes
                      </Button>
                    )}
                    {lang !== 'en' && (
                      <Button size="sm" variant="outline" disabled={translatingKey === id} onClick={() => translateFromEnglish(t)}>
                        {translatingKey === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                        {translatingKey === id ? 'Translating…' : 'Translate from English'}
                      </Button>
                    )}
                    {version.isCustomized && (
                      <Button size="sm" variant="outline" disabled={savingKey === id} onClick={() => resetToDefault(t)}>
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
