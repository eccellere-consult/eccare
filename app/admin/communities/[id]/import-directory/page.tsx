'use client';

import { useState, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, MessageCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCommunityData } from '@/lib/community-client';
import { buildWaLink, toWhatsAppNumber } from '@/lib/whatsapp';
import { renderTemplate, getDefaultBody, messageFragments, combineLanguages } from '@/lib/whatsapp-templates-shared';
import { WhatsAppLanguagePicker } from '@/components/whatsapp-language-picker';

interface DirectoryImportRow {
  rowNumber: number;
  name: string;
  houseNumber: string | null;
  rawPhone: string;
  phone: string | null;
  status: 'ready' | 'duplicate-in-file' | 'already-registered' | 'already-imported' | 'will-add-house';
  existingLabel?: string | null;
}
interface CreatedEntry {
  id: string;
  name: string;
  phone: string | null;
}
interface PendingEntry extends CreatedEntry {
  flatNumber: string | null;
  invitedAt: string | null;
}
interface Recipient {
  id: string;
  name: string;
  phone: string;
}
interface NeighborhoodDetail {
  id: string;
  name: string;
  joinCode: string;
}

const STATUS_LABEL: Record<DirectoryImportRow['status'], string> = {
  ready: 'Ready',
  'duplicate-in-file': 'Duplicate in file',
  'already-registered': 'Already a registered member',
  'already-imported': 'Already in directory',
  'will-add-house': 'Will add house no.',
};
const STATUS_VARIANT: Record<DirectoryImportRow['status'], 'success' | 'danger' | 'muted' | 'accent'> = {
  ready: 'success',
  'duplicate-in-file': 'accent',
  'already-registered': 'accent',
  'already-imported': 'accent',
  'will-add-house': 'success',
};

export default function ImportDirectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: neighborhoodId } = use(params);
  const { data: neighborhood } = useCommunityData<NeighborhoodDetail>(`/community/neighborhoods/${neighborhoodId}`);
  const { data: messageTemplates } = useCommunityData<Record<string, Record<string, string>>>('/whatsapp-templates?lang=all');

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DirectoryImportRow[] | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: CreatedEntry[]; updated: number; skipped: number } | null>(null);
  const [importVersion, setImportVersion] = useState(0);

  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('neighborhoodId', neighborhoodId);
      const res = await fetch('/api/v1/community/import-directory', { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not read the file.');
      const newRows: DirectoryImportRow[] = json.data.rows;
      setRows(newRows);
      setIncluded(
        new Set(newRows.filter((r) => r.status === 'ready' || r.status === 'will-add-house').map((r) => r.rowNumber)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file || !rows) return;
    setLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('neighborhoodId', neighborhoodId);
      body.append('commit', 'true');
      body.append('includeRows', JSON.stringify(Array.from(included)));
      const res = await fetch('/api/v1/community/import-directory', { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Import failed.');
      setResult({ created: json.data.created, updated: json.data.updated ?? 0, skipped: json.data.skipped });
      setRows(null);
      setFile(null);
      // Remounts PendingInvites so it refetches and includes what was just added.
      setImportVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(rowNumber: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  return (
    <div>
      <Link
        href={`/admin/communities/${neighborhoodId}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to community
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Bulk-add to Local Directory</h1>
      <p className="mt-1 text-text-secondary">
        Upload a register (.xlsx) with Name, House No. (or GR No.), and Mobile No. columns — column order
        doesn&rsquo;t matter. Re-uploading a file fills in house numbers that are still blank for people already listed. This only adds entries to the community&rsquo;s Local Directory — it does <strong>not</strong>{' '}
        create any account or password. Everyone you add shows up below, where you can send them a WhatsApp
        invite to register at any time.
      </p>

      {result && (
        <Card className="mt-4 border-success-100 bg-success-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="font-semibold text-success-900">
              Added {result.created.length} {result.created.length === 1 ? 'entry' : 'entries'} to the directory
              {result.updated > 0 ? `, filled in the house number for ${result.updated} already listed` : ''}
              {result.skipped > 0 ? ` — ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped.` : '.'}
            </p>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>
              Upload another file
            </Button>
          </CardContent>
        </Card>
      )}

      {!result && !rows && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={preview} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="file">Directory register (.xlsx)</Label>
                <Input id="file" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <Button type="submit" disabled={!file || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Reading…' : 'Preview'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {rows && (
        <>
          <Card className="mt-4">
            <CardContent className="flex items-center justify-between gap-3 pt-6">
              <p className="text-sm text-text-secondary">No password needed — these entries only appear in the directory.</p>
              <Button onClick={commit} disabled={loading || included.size === 0}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Adding…' : `Add ${included.size} to directory`}
              </Button>
            </CardContent>
          </Card>
          {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-text-secondary">
                  <th className="px-3 py-2 font-semibold"></th>
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">House No.</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={included.has(row.rowNumber)} onChange={() => toggle(row.rowNumber)} />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-semibold text-text">{row.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.houseNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.phone ?? (row.rawPhone || '—')}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                        {row.existingLabel && (
                          <span className="text-xs text-text-secondary">Matches: {row.existingLabel}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Lives on the page itself, not behind the upload: the invite step used
          to appear only once, right after a commit, so closing it (or leaving
          the page) left no way back to invite the people already added. */}
      {!rows && (
        <PendingInvites
          key={importVersion}
          neighborhoodId={neighborhoodId}
          community={neighborhood ?? null}
          templates={messageTemplates}
        />
      )}
    </div>
  );
}

/** Everyone in this community's directory who hasn't registered yet, with
 *  invite status, plus the send-through-WhatsApp queue. */
function PendingInvites({
  neighborhoodId,
  community,
  templates,
}: {
  neighborhoodId: string;
  community: NeighborhoodDetail | null;
  templates: Record<string, Record<string, string>> | null;
}) {
  const { data, loading, reload } = useCommunityData<PendingEntry[]>(
    `/community/directory/unregistered?neighborhoodId=${neighborhoodId}`,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<Recipient[] | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [languages, setLanguages] = useState<string[]>(['en']);

  // Pre-select everyone with a phone who hasn't been invited yet — the usual
  // "invite the rest" case — once, on first load, so later manual ticks and
  // untick aren't overwritten by a reload.
  useEffect(() => {
    if (data && !initialised) {
      setSelected(new Set(data.filter((e) => e.phone && !e.invitedAt).map((e) => e.id)));
      setInitialised(true);
    }
  }, [data, initialised]);

  const entries = data ?? [];
  const invitable = entries.filter((e) => e.phone);

  function startQueue() {
    setQueue(
      invitable
        .filter((e) => selected.has(e.id))
        .map((e) => ({ id: e.id, name: e.name, phone: e.phone as string })),
    );
  }

  if (queue) {
    return (
      <InviteQueue
        recipients={queue}
        community={community}
        templates={templates}
        languages={languages}
        onClose={() => {
          setQueue(null);
          reload();
        }}
      />
    );
  }

  const allSelected = invitable.length > 0 && invitable.every((e) => selected.has(e.id));

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <h2 className="text-lg font-bold text-text">Invite to register</h2>
          <p className="text-sm text-text-secondary">
            People in the directory who haven&rsquo;t registered yet. Each invite is a WhatsApp message with the
            sign-up link and this community&rsquo;s join code — you tap Send yourself for each one. Once someone
            registers and joins, they drop off this list automatically.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nobody pending — everyone in the directory has registered, or no one has been added yet.
          </p>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-text-secondary">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(invitable.map((e) => e.id)))
                        }
                      />
                    </th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">House No.</th>
                    <th className="px-3 py-2 font-semibold">Phone</th>
                    <th className="px-3 py-2 font-semibold">Invite</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${e.name}`}
                          disabled={!e.phone}
                          checked={selected.has(e.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(e.id)) next.delete(e.id);
                              else next.add(e.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-text">{e.name}</td>
                      <td className="px-3 py-2 text-text-secondary">{e.flatNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-text-secondary">{e.phone ?? '—'}</td>
                      <td className="px-3 py-2">
                        {!e.phone ? (
                          <Badge variant="muted">No phone</Badge>
                        ) : e.invitedAt ? (
                          <Badge variant="success">
                            Invited {new Date(e.invitedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                          </Badge>
                        ) : (
                          <Badge variant="accent">Not invited</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <WhatsAppLanguagePicker languages={languages} setLanguages={setLanguages} />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={startQueue} disabled={selected.size === 0 || !community} className="w-fit">
                <MessageCircle className="h-4 w-4" /> Start inviting {selected.size || ''}{' '}
                {selected.size === 1 ? 'person' : 'people'}
              </Button>
              {!community && <span className="text-xs text-text-secondary">Loading community details…</span>}
            </div>
            <p className="text-xs text-text-secondary">
              Steps through each selected person one at a time. Nothing here uses a paid WhatsApp API, so nothing
              sends automatically. Tick people who were already invited to remind them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Steps through recipients one at a time — same free wa.me/sms share-intent
 *  pattern as Admin → WhatsApp Invite's bulk mode. Marking someone sent also
 *  records invitedAt on their directory entry, so the pending list can show
 *  who's already been invited. */
function InviteQueue({
  recipients,
  community,
  templates,
  languages,
  onClose,
}: {
  recipients: Recipient[];
  community: NeighborhoodDetail | null;
  templates: Record<string, Record<string, string>> | null;
  languages: string[];
  onClose: () => void;
}) {
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const registrationLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://eccare.in/login';
  // One block per selected language (stacked when more than one), each with its
  // own wording and its own "join our community" line; {{name}} is filled per
  // recipient below.
  const baseMessage = combineLanguages(
    languages.map((lang) =>
      renderTemplate(templates?.[lang]?.invite ?? getDefaultBody('invite', lang), {
        link: registrationLink,
        community_line: community ? messageFragments(lang).communityLine(community.name, community.joinCode) : '',
      }).replace(/\n+$/, ''),
    ),
  );

  const recipient = recipients[queueIndex];
  const isLast = queueIndex === recipients.length - 1;
  const isSent = sentIds.has(recipient.id);

  function markSentAndNext() {
    if (!sentIds.has(recipient.id)) {
      // Fire-and-forget: the invite itself already went out in WhatsApp, so a
      // failed bookkeeping write must never block stepping to the next person.
      fetch(`/api/v1/community/directory/unregistered/${recipient.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited: true }),
      }).catch(() => {});
    }
    setSentIds((prev) => new Set(prev).add(recipient.id));
    if (!isLast) setQueueIndex((i) => i + 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        markSentAndNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, sentIds]);

  // Keeps the next button focused so a bare Enter works as soon as the admin
  // switches back from WhatsApp.
  useEffect(() => {
    nextButtonRef.current?.focus();
    function onVisible() {
      if (document.visibilityState === 'visible') nextButtonRef.current?.focus();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [queueIndex]);

  if (!recipient) return null;
  const personalized = baseMessage.replace(/\{\{name\}\}/g, recipient.name);
  const waLink = buildWaLink(recipient.phone, personalized);
  const smsLink = `sms:+${toWhatsAppNumber(recipient.phone)}?body=${encodeURIComponent(personalized)}`;

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-secondary">
            {queueIndex + 1} of {recipients.length}
            {isSent ? ' — marked sent' : ''}
          </p>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-danger-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary-600 transition-all"
            style={{ width: `${((queueIndex + (isSent ? 1 : 0)) / recipients.length) * 100}%` }}
          />
        </div>

        <div>
          <p className="text-lg font-bold text-text">{recipient.name}</p>
          <p className="text-sm text-text-secondary">{recipient.phone}</p>
        </div>

        <textarea
          readOnly
          value={personalized}
          rows={9}
          className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="gap-2">
              <MessageCircle className="h-4 w-4" /> Open WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={smsLink} className="gap-2">Open SMS</a>
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          SMS only opens an app if you&rsquo;re on a phone browser — desktop browsers have no default SMS app.
        </p>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={queueIndex === 0} onClick={() => setQueueIndex((i) => i - 1)}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button ref={nextButtonRef} onClick={markSentAndNext} disabled={isLast && isSent}>
            {isLast ? 'Mark sent — done' : 'Sent — next'} <ChevronRight className="h-4 w-4" />
          </Button>
          {!isLast && <Button variant="outline" onClick={() => setQueueIndex((i) => i + 1)}>Skip</Button>}
          {isLast && isSent && <Button variant="outline" onClick={onClose}>Finish</Button>}
        </div>
        <p className="text-xs text-text-secondary">
          Press <span className="font-mono font-semibold">Enter</span> to advance — works as soon as you switch back to this tab.
        </p>
      </CardContent>
    </Card>
  );
}
