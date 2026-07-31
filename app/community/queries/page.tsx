'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface Query {
  id: string;
  type: 'committee' | 'helpdesk';
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  user: { id: string; name: string };
  _count: { replies: number };
}

const STATUS_VARIANT = {
  open: 'danger',
  in_progress: 'accent',
  resolved: 'success',
  closed: 'muted',
} as const;

export default function QueriesPage() {
  const { data, loading, error, reload } = useCommunityData<Query[]>('/community/queries');
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'committee' | 'helpdesk'>('committee');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/queries', { type, subject, body });
      setSubject('');
      setBody('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Committee & Help desk"
      subtitle="Raise a query with your management committee, or ask for general help."
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Raise a query'}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="No queries raised yet."
    >
      <div className="flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Who is this for?</Label>
                  <div className="flex h-12 items-center rounded-xl bg-primary-50 p-1">
                    {([
                      ['committee', 'Management committee'],
                      ['helpdesk', 'Help desk'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={cn(
                          'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
                          type === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="body">Details</Label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    className="rounded-xl border border-border bg-surface p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !subject.trim() || !body.trim()}>
                  {busy ? 'Submitting…' : 'Submit'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((q) => (
          <Card key={q.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-bold text-text">{q.subject}</h2>
                <div className="flex gap-2">
                  <Badge variant="muted">{q.type === 'committee' ? 'Committee' : 'Help desk'}</Badge>
                  <Badge variant={STATUS_VARIANT[q.status]}>{q.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-text">{q.body}</p>
              <p className="mt-3 text-sm text-text-secondary">
                {q.user.name} · {new Date(q.createdAt).toLocaleDateString()}
                {q._count.replies > 0 && ` · ${q._count.replies} repl${q._count.replies === 1 ? 'y' : 'ies'}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
