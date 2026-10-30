'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, Send, Sparkles, X, Pencil, Copy, Check, MessageCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Flag {
  level: 'block' | 'warn';
  code: string;
  message: string;
}
interface Bulletin {
  id: string;
  topic: string;
  title: string;
  body: string;
  whatsappText: string;
  sources: { title: string; url: string; publisher?: string }[];
  flags: Flag[] | null;
  status: 'draft' | 'published' | 'rejected';
  model: string | null;
  generatedAt: string;
  reviewedByName: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  noticeIds: { neighborhoodId: string; noticeId: string }[] | null;
}
interface Community {
  id: string;
  name: string;
  city: string | null;
  whatsAppGroups: { id: string; name: string; inviteUrl: string }[];
}
interface PageData {
  bulletins: Bulletin[];
  communities: Community[];
  topics: { id: string; label: string }[];
  agent: { configured: boolean; model: string; scheduled: boolean };
}

const TABS = [
  { id: 'draft', label: 'Needs review' },
  { id: 'published', label: 'Published' },
  { id: 'rejected', label: 'Rejected' },
] as const;

const STATUS_VARIANT = { draft: 'accent', published: 'success', rejected: 'muted' } as const;

const textareaClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export default function AdminHealthBulletinsPage() {
  const { data, loading, error, reload } = useCommunityData<PageData>('/admin/health-bulletins');
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('draft');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  async function generate() {
    setGenerating(true);
    setGenerateError('');
    try {
      await communityApi.post('/admin/health-bulletins', { topic: topic || undefined });
      setTab('draft');
      await reload();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not write a draft.');
    } finally {
      setGenerating(false);
    }
  }

  const shown = useMemo(() => (data?.bulletins ?? []).filter((b) => b.status === tab), [data, tab]);
  const counts = useMemo(() => {
    const c = { draft: 0, published: 0, rejected: 0 };
    for (const b of data?.bulletins ?? []) c[b.status]++;
    return c;
  }, [data]);
  const topicLabel = (id: string) => data?.topics.find((t) => t.id === id)?.label ?? id;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Health Bulletins</h1>
      <p className="mt-1 max-w-3xl text-text-secondary">
        An agent searches trusted health sources (WHO, NHS, NIH, AAO, India's health ministry and others) and writes short,
        plain-language tips — glaucoma care, staying active and more. <strong>Nothing is published until you read it and approve it.</strong>{' '}
        Approved bulletins become a Notice in the communities you choose, with a ready-to-send WhatsApp message.
      </p>

      {data && !data.agent.configured && (
        <Card className="mt-4 border-danger-100 bg-danger-50">
          <CardContent className="flex items-start gap-2 pt-6 text-sm text-danger-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            The agent is not set up yet: add <code className="mx-1 rounded bg-surface px-1">HEALTH_AGENT_API_KEY</code> (or the shared
            <code className="mx-1 rounded bg-surface px-1">ANTHROPIC_API_KEY</code>) to the server's environment variables, with web search switched on
            in the Anthropic console.
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-2">
            <Label htmlFor="topic">Write a new draft about</Label>
            <select
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <option value="">Choose for me (the topic that is due)</option>
              {data?.topics.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={generate} disabled={generating || !data?.agent.configured}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Searching… up to a minute' : 'Write a draft'}
          </Button>
        </CardContent>
        {generateError && <p className="px-6 pb-4 text-sm text-danger-600">{generateError}</p>}
        <p className="px-6 pb-4 text-xs text-text-secondary">
          {data?.agent.scheduled
            ? 'Weekly drafting is switched on — new drafts appear here by themselves.'
            : 'Weekly drafting is off. To turn it on, set CRON_SECRET and schedule the call described in docs/HEALTH_BULLETIN_AGENT.md.'}
        </p>
      </Card>

      <div className="mt-6 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-primary-600 text-white' : 'bg-surface text-text-secondary border border-border'}`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-danger-600">{error}</CardContent></Card>
        ) : shown.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              {tab === 'draft' ? 'No drafts waiting. Write one above.' : tab === 'published' ? 'Nothing published yet.' : 'Nothing rejected.'}
            </CardContent>
          </Card>
        ) : (
          shown.map((b) => (
            <BulletinCard key={b.id} bulletin={b} communities={data?.communities ?? []} topicLabel={topicLabel(b.topic)} onChanged={reload} />
          ))
        )}
      </div>
    </div>
  );
}

function BulletinCard({ bulletin: b, communities, topicLabel, onChanged }: { bulletin: Bulletin; communities: Community[]; topicLabel: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: b.title, body: b.body, whatsappText: b.whatsappText });
  const [publishing, setPublishing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const blocks = (b.flags ?? []).filter((f) => f.level === 'block');
  const warns = (b.flags ?? []).filter((f) => f.level === 'warn');
  const publishedIds = new Set((b.noticeIds ?? []).map((p) => p.neighborhoodId));
  const available = communities.filter((c) => !publishedIds.has(c.id));
  // The WhatsApp groups to paste into: those of the communities it is going to / has gone to.
  const groupCommunities = communities.filter((c) => (picked.length ? picked.includes(c.id) : publishedIds.has(c.id)) && c.whatsAppGroups.length);

  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: okText });
      onChanged();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await communityApi.patch(`/admin/health-bulletins/${b.id}`, form);
      setEditing(false);
    }, 'Saved. The safety checks ran again on your wording.');

  const reject = () => {
    const reason = prompt('Why are you rejecting this? (optional)') ?? null;
    if (reason === null) return;
    void run(() => communityApi.post(`/admin/health-bulletins/${b.id}/reject`, { reason }), 'Rejected.');
  };

  const publish = () => {
    if (!picked.length) return setMessage({ kind: 'error', text: 'Please choose at least one community.' });
    if (!confirm(`Post this as a notice in ${picked.length} communit${picked.length === 1 ? 'y' : 'ies'}? Residents will see it straight away.`)) return;
    void run(async () => {
      await communityApi.post(`/admin/health-bulletins/${b.id}/publish`, { neighborhoodIds: picked });
      setPublishing(false);
    }, 'Published as a notice. Now share the WhatsApp message below.');
  };

  const shareUrl = `https://wa.me/?text=${encodeURIComponent(b.whatsappText)}`;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-text">{b.title}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {topicLabel} · written {new Date(b.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {b.reviewedByName ? ` · reviewed by ${b.reviewedByName}` : ''}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[b.status]}>{b.status === 'draft' ? 'needs review' : b.status}</Badge>
        </div>

        {(blocks.length > 0 || warns.length > 0) && (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {blocks.map((f, i) => (
              <li key={`b${i}`} className="text-danger-600">⛔ {f.message}</li>
            ))}
            {warns.map((f, i) => (
              <li key={`w${i}`} className="text-accent-600">⚠️ {f.message}</li>
            ))}
          </ul>
        )}
        {b.status === 'rejected' && b.rejectionReason && <p className="mt-3 text-sm text-text-secondary">Reason: {b.rejectionReason}</p>}

        {editing ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`t-${b.id}`}>Title</Label>
              <Input id={`t-${b.id}`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`b-${b.id}`}>Notice text</Label>
              <textarea id={`b-${b.id}`} rows={12} className={textareaClass} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`w-${b.id}`}>WhatsApp message</Label>
              <textarea id={`w-${b.id}`} rows={12} className={textareaClass} value={form.whatsappText} onChange={(e) => setForm((f) => ({ ...f, whatsappText: e.target.value }))} />
            </div>
            <p className="text-xs text-text-secondary">The "not medical advice" line must stay in both, and doses or "stop your medicine" wording are not allowed.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={save}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm({ title: b.title, body: b.body, whatsappText: b.whatsappText }); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-text-secondary">Notice</p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-primary-50 p-4 font-sans text-sm text-text">{b.body}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-text-secondary">WhatsApp message</p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-success-50 p-4 font-sans text-sm text-text">{b.whatsappText}</pre>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {b.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> {s.publisher ?? 'Source'}: {s.title || s.url}
            </a>
          ))}
        </div>

        {message && <p className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-success-600' : 'text-danger-600'}`}>{message.text}</p>}

        {b.status !== 'rejected' && !editing && (
          <div className="mt-4 flex flex-wrap gap-2">
            {b.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            )}
            {available.length > 0 && (
              <Button size="sm" disabled={busy || blocks.length > 0} onClick={() => setPublishing((v) => !v)}>
                <Send className="h-3.5 w-3.5" /> {b.status === 'published' ? 'Publish to more communities' : 'Approve & publish as notice'}
              </Button>
            )}
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" type="button"><MessageCircle className="h-3.5 w-3.5" /> Open in WhatsApp</Button>
            </a>
            <Button size="sm" variant="outline" onClick={async () => { await copyToClipboard(b.whatsappText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy WhatsApp message'}
            </Button>
            {b.status === 'draft' && (
              <Button size="sm" variant="outline" className="text-danger-600" disabled={busy} onClick={reject}><X className="h-3.5 w-3.5" /> Reject</Button>
            )}
          </div>
        )}

        {publishing && (
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-text">Post as a notice in…</p>
              <button className="text-sm font-semibold text-primary-600" onClick={() => setPicked(picked.length === available.length ? [] : available.map((c) => c.id))}>
                {picked.length === available.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="mt-2 grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
              {available.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary-50">
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                  <span>{c.name}{c.city ? ` — ${c.city}` : ''}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={busy || !picked.length} onClick={publish}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish to {picked.length || 'selected'} communit{picked.length === 1 ? 'y' : 'ies'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPublishing(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {groupCommunities.length > 0 && b.status !== 'rejected' && (
          <div className="mt-4 rounded-xl bg-success-50 p-4 text-sm">
            <p className="font-semibold text-text">Send it to the WhatsApp group</p>
            <p className="mt-1 text-text-secondary">
              WhatsApp does not let apps post into groups, so: tap <strong>Open in WhatsApp</strong> above, pick the group, and press send — or copy the
              message and paste it there.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {groupCommunities.flatMap((c) =>
                c.whatsAppGroups.map((g) => (
                  <li key={g.id}>
                    <span className="text-text">{c.name} — {g.name}</span>{' '}
                    <a href={g.inviteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:underline">open group →</a>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
