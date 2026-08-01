'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface DailyQuoteItem {
  id: string;
  text: string;
  author: string | null;
  status: 'pending' | 'approved' | 'rejected';
  generatedBy: string | null;
  usedOn: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<DailyQuoteItem['status'], 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  approved: 'success',
  rejected: 'danger',
};

export default function AdminQuotesPage() {
  const { data, loading, error, reload } = useCommunityData<DailyQuoteItem[]>('/admin/quotes');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setGenError('');
    try {
      await communityApi.post('/admin/quotes', { count: 5 });
      reload();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Could not generate quotes.');
    } finally {
      setGenerating(false);
    }
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/quotes/${id}`, { status: 'approved' });
      reload();
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/quotes/${id}`, { method: 'DELETE', credentials: 'include' });
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
          <h1 className="text-2xl font-bold text-text">Daily Quotes</h1>
          <p className="mt-1 text-text-secondary">
            Approved quotes are shown one per day at the top of the elder home page.
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate 5 quotes'}
        </Button>
      </div>

      {genError && <p className="mt-3 text-sm text-danger-600">{genError}</p>}

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
          </Card>
        ) : (data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              No quotes yet. Click &ldquo;Generate 5 quotes&rdquo; to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((q) => (
              <Card key={q.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={STATUS_BADGE[q.status]}>{q.status}</Badge>
                    {q.usedOn && (
                      <span className="text-xs text-text-secondary">
                        Used on: {new Date(q.usedOn).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 italic text-text">&ldquo;{q.text}&rdquo;</p>
                  {q.author && <p className="mt-1 text-sm text-text-secondary">— {q.author}</p>}
                  {q.status === 'pending' && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" disabled={busyId === q.id} onClick={() => approve(q.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === q.id} onClick={() => remove(q.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
