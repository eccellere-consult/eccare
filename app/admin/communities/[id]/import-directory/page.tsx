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
import { renderTemplate, getTemplateDef } from '@/lib/whatsapp-templates-shared';

interface DirectoryImportRow {
  rowNumber: number;
  name: string;
  houseNumber: string | null;
  rawPhone: string;
  phone: string | null;
  status: 'ready' | 'duplicate-in-file' | 'already-registered' | 'already-imported';
  existingLabel?: string | null;
}
interface CreatedEntry {
  id: string;
  name: string;
  phone: string | null;
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
};
const STATUS_VARIANT: Record<DirectoryImportRow['status'], 'success' | 'danger' | 'muted' | 'accent'> = {
  ready: 'success',
  'duplicate-in-file': 'accent',
  'already-registered': 'accent',
  'already-imported': 'accent',
};

export default function ImportDirectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: neighborhoodId } = use(params);
  const { data: neighborhood } = useCommunityData<NeighborhoodDetail>(`/community/neighborhoods/${neighborhoodId}`);
  const { data: messageTemplates } = useCommunityData<Record<string, string>>('/whatsapp-templates');
  const inviteTemplate = messageTemplates?.invite ?? getTemplateDef('invite').defaultBody;

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DirectoryImportRow[] | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: CreatedEntry[]; skipped: number } | null>(null);

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
      setIncluded(new Set(newRows.filter((r) => r.status === 'ready').map((r) => r.rowNumber)));
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
      setResult({ created: json.data.created, skipped: json.data.skipped });
      setRows(null);
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
        Upload a register (.xlsx) with Name, House Name/No, and Mobile No. columns — column order doesn&rsquo;t
        matter. This only adds entries to the community&rsquo;s Local Directory — it does <strong>not</strong>{' '}
        create any account or password. Rows with a phone number get a WhatsApp invite to register afterward.
      </p>

      {result && (
        <InviteStep
          created={result.created}
          skipped={result.skipped}
          neighborhoodId={neighborhoodId}
          community={neighborhood ?? null}
          inviteTemplate={inviteTemplate}
          onDone={() => setResult(null)}
        />
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
    </div>
  );
}

/** Steps through the just-created entries one at a time, same free wa.me
 *  share-intent pattern as Admin → WhatsApp Invite's bulk mode (no paid API
 *  — the admin still taps Send themselves for every message). Only entries
 *  with a phone number get a queue slot. */
function InviteStep({
  created,
  skipped,
  community,
  inviteTemplate,
  onDone,
}: {
  created: CreatedEntry[];
  skipped: number;
  neighborhoodId: string;
  community: NeighborhoodDetail | null;
  inviteTemplate: string;
  onDone: () => void;
}) {
  const withPhone = created.filter((c): c is CreatedEntry & { phone: string } => !!c.phone);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const registrationLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://eccare.in/login';
  const baseMessage = renderTemplate(inviteTemplate, {
    link: registrationLink,
    community_line: community ? `Then join our community "${community.name}" with code: ${community.joinCode}` : '',
  }).replace(/\n+$/, '');

  function personalize(entry: CreatedEntry) {
    return baseMessage.replace(/\{\{name\}\}/g, entry.name);
  }

  function markSentAndNext() {
    setSentIds((prev) => new Set(prev).add(withPhone[queueIndex].id));
    if (queueIndex < withPhone.length - 1) setQueueIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!started) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        markSentAndNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, queueIndex]);

  useEffect(() => {
    if (!started) return;
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
  }, [started, queueIndex]);

  return (
    <Card className="mt-4 border-success-100 bg-success-50">
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="font-semibold text-success-900">
          Added {created.length} {created.length === 1 ? 'entry' : 'entries'} to the directory
          {skipped > 0 ? ` — ${skipped} row${skipped === 1 ? '' : 's'} skipped.` : '.'}
        </p>

        {withPhone.length === 0 ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-success-900/80">None of the added entries had a phone number to invite.</p>
            <Button size="sm" variant="outline" onClick={onDone}>Import more</Button>
          </div>
        ) : !started ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setStarted(true)} className="w-fit">
              <MessageCircle className="h-4 w-4" /> Invite {withPhone.length} by WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={onDone}>Skip</Button>
          </div>
        ) : (
          (() => {
            const recipient = withPhone[queueIndex];
            const personalized = personalize(recipient);
            const waLink = buildWaLink(recipient.phone, personalized);
            const smsLink = `sms:+${toWhatsAppNumber(recipient.phone)}?body=${encodeURIComponent(personalized)}`;
            const isSent = sentIds.has(recipient.id);
            const isLast = queueIndex === withPhone.length - 1;

            return (
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-secondary">
                    {queueIndex + 1} of {withPhone.length}{isSent ? ' — marked sent' : ''}
                  </p>
                  <button onClick={onDone} aria-label="Close" className="text-text-secondary hover:text-danger-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${((queueIndex + (isSent ? 1 : 0)) / withPhone.length) * 100}%` }}
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
                  className="rounded-xl border border-border bg-bg p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
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

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button variant="outline" disabled={queueIndex === 0} onClick={() => setQueueIndex((i) => i - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button ref={nextButtonRef} onClick={markSentAndNext} disabled={isLast && isSent}>
                    {isLast ? 'Mark sent — done' : 'Sent — next'} <ChevronRight className="h-4 w-4" />
                  </Button>
                  {!isLast && (
                    <Button variant="outline" onClick={() => setQueueIndex((i) => i + 1)}>Skip</Button>
                  )}
                  {isLast && isSent && (
                    <Button variant="outline" onClick={onDone}>Done — import more</Button>
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  Press <span className="font-mono font-semibold">Enter</span> to advance.
                </p>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
