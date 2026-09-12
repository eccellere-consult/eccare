'use client';

import { useState } from 'react';
import { FileText, Download, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

type DocCategory = 'bylaws' | 'minutes' | 'notice' | 'other';

interface Doc {
  id: string;
  title: string;
  category: DocCategory;
  fileName: string;
  filePath: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

const CATEGORIES: { key: DocCategory; labelKey: TranslationKey }[] = [
  { key: 'bylaws', labelKey: 'community.documents.categoryBylaws' },
  { key: 'minutes', labelKey: 'community.documents.categoryMinutes' },
  { key: 'notice', labelKey: 'community.documents.categoryNotice' },
  { key: 'other', labelKey: 'community.documents.categoryOther' },
];

export default function DocumentsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, reload } = useCommunityData<Doc[]>('/community/documents');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('other');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setFormError('');
    try {
      const body = new FormData();
      body.append('title', title);
      body.append('category', category);
      body.append('file', file);
      const res = await fetch('/api/v1/community/documents', { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('community.documents.couldNotUpload'));
      setTitle('');
      setCategory('other');
      setFile(null);
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.documents.couldNotUpload'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('community.documents.confirmRemove'))) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/v1/community/documents/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('community.documents.couldNotRemove'));
      reload();
    } finally {
      setActionId(null);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.documents.title')}
      subtitle={t('community.documents.subtitle')}
      action={canManage ? <Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.documents.upload')}</Button> : undefined}
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage={t('community.documents.noDocuments')}
    >
      <div className="flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={upload} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-title">{t('community.documents.titleLabel')}</Label>
                  <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('community.documents.titlePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-category">{t('community.documents.category')}</Label>
                  <select
                    id="doc-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocCategory)}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{t(c.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doc-file">{t('community.documents.file')}</Label>
                  <input
                    id="doc-file"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !title.trim() || !file} className="self-start">
                  {busy ? t('community.documents.uploading') : t('community.documents.upload')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <FileText className="h-5 w-5 text-primary-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-text">{d.title}</p>
                  <div className="mt-0.5">
                    <Badge variant="muted">{t(CATEGORIES.find((c) => c.key === d.category)?.labelKey ?? 'community.documents.categoryOther')}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {d.uploadedBy.name} · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={d.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${d.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                >
                  <Download className="h-5 w-5" />
                </a>
                {canManage && (
                  <Button size="sm" variant="outline" className="shrink-0 text-danger-600" disabled={actionId === d.id} onClick={() => remove(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CommunityPageFrame>
  );
}
