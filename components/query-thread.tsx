'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { communityApi } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface QuerySummary {
  id: string;
  type: 'committee' | 'helpdesk';
  category?: string | null;
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  user: { id: string; name: string };
  _count: { replies: number };
}

interface Reply {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface QueryDetail extends QuerySummary {
  replies: Reply[];
}

const STATUS_VARIANT = {
  open: 'danger',
  in_progress: 'accent',
  resolved: 'success',
  closed: 'muted',
} as const;

const NEXT_STATUS: Record<QuerySummary['status'], QuerySummary['status'][]> = {
  open: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

/** A single query card that expands to its full reply thread. Any member (or the
 *  author) can reply; only the committee/admin can change status — this mirrors the
 *  exact gating already enforced server-side by PATCH /community/queries/[id], so the
 *  UI here is convenience, not the source of truth. Shared between the resident-facing
 *  queries page and the admin drill-in page's Queries tab. */
export function QueryThread({
  query,
  canManageStatus,
  onUpdated,
}: {
  query: QuerySummary;
  canManageStatus: boolean;
  onUpdated?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadDetail() {
    setLoadingDetail(true);
    setError('');
    try {
      setDetail(await communityApi.get<QueryDetail>(`/community/queries/${query.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load replies.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) loadDetail();
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setBusy(true);
    setError('');
    try {
      const updated = await communityApi.patch<QueryDetail>(`/community/queries/${query.id}`, {
        reply: replyText,
      });
      setDetail(updated);
      setReplyText('');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reply.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: QuerySummary['status']) {
    setBusy(true);
    setError('');
    try {
      const updated = await communityApi.patch<QueryDetail>(`/community/queries/${query.id}`, { status });
      setDetail(updated);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  const status = detail?.status ?? query.status;
  const replyCount = detail?.replies.length ?? query._count.replies;

  return (
    <Card>
      <CardContent className="pt-6">
        <button type="button" onClick={toggle} className="flex w-full flex-wrap items-start justify-between gap-2 text-left">
          <div>
            <h2 className="font-bold text-text">{query.subject}</h2>
            <p className="mt-1 whitespace-pre-wrap text-text">{query.body}</p>
            <p className="mt-2 text-sm text-text-secondary">
              {query.user.name} · {new Date(query.createdAt).toLocaleDateString()}
              {replyCount > 0 && ` · ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="muted">{query.type === 'committee' ? 'Committee' : 'Help desk'}</Badge>
            {query.category && <Badge variant="accent">{query.category}</Badge>}
            <Badge variant={STATUS_VARIANT[status]}>{status.replace('_', ' ')}</Badge>
          </div>
        </button>

        {expanded && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            {loadingDetail ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <>
                {detail?.replies.map((r) => (
                  <div key={r.id} className="rounded-xl bg-primary-50 px-3 py-2">
                    <p className="text-sm text-text">{r.body}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {r.user.name} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}

                {canManageStatus && (
                  <div className="flex flex-wrap gap-2">
                    {NEXT_STATUS[status].map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(s)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-semibold',
                          'bg-border text-text-secondary hover:bg-primary-50 hover:text-primary-900',
                        )}
                      >
                        Mark {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={submitReply} className="flex flex-col gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                  {error && <p className="text-sm text-danger-600">{error}</p>}
                  <Button type="submit" size="sm" disabled={busy || !replyText.trim()} className="self-start">
                    {busy ? 'Sending…' : 'Reply'}
                  </Button>
                </form>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
