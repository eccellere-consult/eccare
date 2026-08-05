'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface WellnessVideo {
  id: string;
  title: string;
  category: 'yoga' | 'exercise' | 'meditation';
  youtubeUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

const CATEGORY_OPTIONS = [
  { value: 'yoga', label: 'Yoga' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'meditation', label: 'Meditation' },
] as const;

export default function AdminWellnessPage() {
  const { data, loading, error, reload } = useCommunityData<WellnessVideo[]>('/admin/wellness');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'yoga' as WellnessVideo['category'], youtubeUrl: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/admin/wellness', {
        title: form.title,
        category: form.category,
        youtubeUrl: form.youtubeUrl,
        description: form.description || undefined,
      });
      setForm({ title: '', category: 'yoga', youtubeUrl: '', description: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add video.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v: WellnessVideo) {
    setBusyId(v.id);
    try {
      await communityApi.patch(`/admin/wellness/${v.id}`, { isActive: !v.isActive });
      reload();
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this video from the wellness list?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/wellness/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed.');
      reload();
    } catch {
      /* ignore — reload will still show the item if delete failed */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Yoga, exercise & meditation</h1>
          <p className="mt-1 text-text-secondary">
            Curated YouTube links shown to elders under Health. Only active videos appear there.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add video'}</Button>
      </div>

      {showForm && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={add} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="w-title">Title</Label>
                  <Input id="w-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Chair yoga for beginners" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="w-category">Category</Label>
                  <select
                    id="w-category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as WellnessVideo['category'] }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="w-url">YouTube link</Label>
                <Input id="w-url" value={form.youtubeUrl} onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="w-desc">Description (optional)</Label>
                <Input id="w-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="15-minute gentle stretch, no equipment needed" />
              </div>
              {formError && <p className="text-sm text-danger-600">{formError}</p>}
              <Button type="submit" disabled={busy || !form.title.trim() || !form.youtubeUrl.trim()} className="self-start">
                {busy ? 'Adding…' : 'Add video'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-danger-600">{error}</CardContent></Card>
        ) : (data?.length ?? 0) === 0 ? (
          <Card><CardContent className="py-12 text-center text-text-secondary">No videos yet. Click &ldquo;Add video&rdquo; to get started.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((v) => (
              <Card key={v.id} className={v.isActive ? '' : 'opacity-60'}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="muted">{v.category}</Badge>
                    {!v.isActive && <Badge variant="danger">Hidden</Badge>}
                  </div>
                  <p className="mt-3 font-bold text-text">{v.title}</p>
                  {v.description && <p className="mt-1 text-sm text-text-secondary">{v.description}</p>}
                  <a href={v.youtubeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-sm text-primary-600 hover:underline">
                    {v.youtubeUrl}
                  </a>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => toggleActive(v)}>
                      {v.isActive ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => remove(v.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
