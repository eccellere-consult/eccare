'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

export default function AnnouncementsPage() {
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data, loading, error, reload } = useCommunityData<Notice[]>('/community/notices');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const canPost = me?.memberships?.[0]?.role !== 'member';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/notices', { title, body });
      setTitle('');
      setBody('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Announcements"
      subtitle="Notices from your management committee."
      action={
        canPost ? (
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'Post announcement'}
          </Button>
        ) : undefined
      }
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="No announcements yet."
    >
      <div className="flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="body">Message</Label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    className="rounded-xl border border-border bg-surface p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
                  {busy ? 'Posting…' : 'Post'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((n) => (
          <Card key={n.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-text">{n.title}</h2>
                {n.pinned && (
                  <Badge variant="accent">
                    <Pin className="mr-1 h-3 w-3" /> Pinned
                  </Badge>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-text">{n.body}</p>
              <p className="mt-3 text-sm text-text-secondary">
                {n.createdBy.name} · {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
