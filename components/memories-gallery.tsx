'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Memory {
  id: string;
  imagePath: string;
  caption: string | null;
  createdAt: string;
  addedBy: { name: string };
}

/** Family-private photo gallery, shared between the elder's own page and the
 *  family per-elder page — same underlying /api/v1/memories, both directions of
 *  canAccessElder allow either side to view, upload, and delete. */
export function MemoriesGallery({ elderUserId }: { elderUserId: string }) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/memories?elderUserId=${elderUserId}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('shared.memoriesGallery.couldNotLoad'));
      setMemories(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shared.memoriesGallery.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }, [elderUserId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('elderUserId', elderUserId);
      if (caption.trim()) formData.append('caption', caption.trim());

      const res = await fetch('/api/v1/memories', { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('shared.memoriesGallery.uploadFailed'));
      setCaption('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shared.memoriesGallery.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    if (!confirm(t('shared.memoriesGallery.confirmDelete'))) return;
    setBusyId(id);
    try {
      await fetch(`/api/v1/memories/${id}`, { method: 'DELETE', credentials: 'include' });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-col gap-2">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('shared.memoriesGallery.addCaption')}
              disabled={uploading}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="self-start gap-2">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t('shared.memoriesGallery.uploading')}
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" /> {t('shared.memoriesGallery.addPhoto')}
              </>
            )}
          </Button>
          {error && <p className="text-sm text-danger-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="mt-4">
        {loading ? (
          <p className="text-text-secondary">{t('shared.memoriesGallery.loading')}</p>
        ) : memories.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-text-secondary">{t('shared.memoriesGallery.noPhotos')}</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((m) => (
              <Card key={m.id} className="overflow-hidden">
                <img src={m.imagePath} alt={m.caption ?? ''} className="h-48 w-full object-cover" />
                <CardContent className="flex items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    {m.caption && <p className="truncate text-sm text-text">{m.caption}</p>}
                    <p className="text-xs text-text-secondary">
                      {m.addedBy.name} · {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(m.id)}
                    disabled={busyId === m.id}
                    aria-label={t('shared.memoriesGallery.deletePhoto')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
