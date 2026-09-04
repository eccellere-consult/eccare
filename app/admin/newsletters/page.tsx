'use client';

import { useState } from 'react';
import { Plus, Send, Eye, Trash2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/rich-text-editor';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface NewsletterItem {
  id: string;
  title: string;
  bodyHtml: string;
  excerpt: string | null;
  audience: 'all_caregivers' | 'all_volunteers' | 'all_elders' | 'everyone';
  status: 'draft' | 'scheduled' | 'published';
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const AUDIENCE_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'all_caregivers', label: 'All caregivers' },
  { value: 'all_volunteers', label: 'Verified volunteers' },
  { value: 'all_elders', label: 'All elders' },
] as const;
const STATUS_VARIANT: Record<NewsletterItem['status'], 'muted' | 'accent' | 'success'> = {
  draft: 'muted',
  scheduled: 'accent',
  published: 'success',
};

const EMPTY_FORM = { title: '', excerpt: '', bodyHtml: '', audience: 'everyone' as NewsletterItem['audience'], scheduledFor: '' };

export default function AdminNewslettersPage() {
  const { data, loading, error, reload } = useCommunityData<NewsletterItem[]>('/admin/newsletters');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; emailsSent: number; pushSent: number; recipients: number } | null>(null);

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(n: NewsletterItem) {
    setForm({
      title: n.title,
      excerpt: n.excerpt ?? '',
      bodyHtml: n.bodyHtml,
      audience: n.audience,
      scheduledFor: n.scheduledFor ? n.scheduledFor.slice(0, 16) : '',
    });
    setEditingId(n.id);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.bodyHtml.trim()) {
      setFormError('Please enter a title and body.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || undefined,
        bodyHtml: form.bodyHtml,
        audience: form.audience,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
      };
      if (editingId) {
        await communityApi.patch(`/admin/newsletters/${editingId}`, payload);
      } else {
        await communityApi.post('/admin/newsletters', payload);
      }
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this newsletter?')) return;
    await communityApi.delete(`/admin/newsletters/${id}`);
    reload();
  }

  async function publish(id: string) {
    if (!confirm('Publish and send this newsletter now via email and push notification?')) return;
    setPublishingId(id);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/v1/admin/newsletters/${id}/publish`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not publish.');
      setPublishResult({ id, emailsSent: json.data.emailsSent, pushSent: json.data.pushSent, recipients: json.data.recipients });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not publish.');
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Newsletters</h1>
          <p className="mt-1 text-text-secondary">
            Draft, preview, and publish updates to segmented user groups via email and push.
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="h-4 w-4" /> New newsletter
        </Button>
      </div>

      <p className="mt-2 text-xs text-text-secondary">
        Note: "Schedule" saves a target date, but there's no background job runner on this host to
        auto-send at that time — you'll still need to come back and hit Publish when it's due.
      </p>

      {showForm && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={save} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="n-title">Title</Label>
                <Input id="n-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="September community update" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="n-excerpt">Excerpt (optional — shown in the archive list and push notification)</Label>
                <Input id="n-excerpt" value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Body</Label>
                <RichTextEditor value={form.bodyHtml} onChange={(html) => setForm((f) => ({ ...f, bodyHtml: html }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="n-audience">Audience</Label>
                  <select
                    id="n-audience"
                    value={form.audience}
                    onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as NewsletterItem['audience'] }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="n-schedule">Target send date (optional)</Label>
                  <Input id="n-schedule" type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))} />
                </div>
              </div>
              {formError && <p className="text-sm text-danger-600">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
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
          <Card><CardContent className="py-12 text-center text-text-secondary">No newsletters yet.</CardContent></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.map((n) => (
              <Card key={n.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-text">{n.title}</p>
                      {n.excerpt && <p className="mt-1 text-sm text-text-secondary">{n.excerpt}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[n.status]}>{n.status}</Badge>
                      <Badge variant="muted">{AUDIENCE_OPTIONS.find((a) => a.value === n.audience)?.label}</Badge>
                    </div>
                  </div>
                  {publishResult?.id === n.id && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-success-600">
                      <Mail className="h-3.5 w-3.5" />
                      Sent to {publishResult.recipients} recipients — {publishResult.emailsSent} emails, {publishResult.pushSent} push notifications.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {n.status !== 'published' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(n)}>
                          <Eye className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" disabled={publishingId === n.id} onClick={() => publish(n.id)}>
                          <Send className="h-3.5 w-3.5" /> {publishingId === n.id ? 'Sending…' : 'Publish now'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-danger-600" onClick={() => remove(n.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {n.status === 'published' && (
                      <a href={`/newsletter/${n.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary-600 hover:underline">
                        View public page →
                      </a>
                    )}
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
