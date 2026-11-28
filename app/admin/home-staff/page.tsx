'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Sparkles, UserCheck, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FeatureSwitchCard } from '@/components/admin/feature-switch-card';
import { DOC_KIND_LABEL, LISTING_STATUS_LABEL, RATE_UNIT_LABEL, staffRole, type DocKind, type ListingStatus, type RateUnit } from '@/lib/care-staff';

interface AdminListing {
  id: string;
  personName: string;
  role: string;
  qualification: string | null;
  experienceYears: number | null;
  languages: string | null;
  about: string | null;
  aadhaarLast4: string | null;
  expectedSalary: number | null;
  status: ListingStatus;
  adminNote: string | null;
  submittedAt: string | null;
  verifiedUntil: string | null;
  documents: { id: string; kind: string; fileName: string; expiresOn: string | null; aiNote: string | null }[];
  rates: { id: string; unit: string; proposedAmount: number; approvedAmount: number | null; note: string | null }[];
  provider: {
    businessName: string;
    phone: string | null;
    verificationStatus: string;
    serviceArea: string | null;
    user: { name: string; email: string | null; phone: string | null };
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  return json.data as T;
}

const STATUS_VARIANT: Record<ListingStatus, 'accent' | 'success' | 'danger' | 'muted'> = {
  draft: 'muted',
  submitted: 'accent',
  changes_needed: 'danger',
  approved: 'success',
  rejected: 'danger',
  paused: 'muted',
};

/** EC checks each home-care staff person: documents (with the AI's reading of certificates),
 *  the provider account, and the rates families will see. */
export default function AdminHomeStaffPage() {
  const [data, setData] = useState<{ enabled: boolean; listings: AdminListing[] } | null>(null);
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ enabled: boolean; listings: AdminListing[] }>('/admin/home-staff')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);
  useEffect(load, [load]);

  if (!data) return <p className="text-text-secondary">{error || 'Loading…'}</p>;
  const shown = data.listings.filter((l) => filter === 'all' || l.status === 'submitted');
  const waiting = data.listings.filter((l) => l.status === 'submitted').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <UserCheck className="h-6 w-6 text-primary-600" /> Home-care staff
        </h1>
        <p className="mt-1 text-text-secondary">
          Nurses, doctors, caretakers, security, cooks and house help. Check the documents, then approve the rates
          families will see.
        </p>
      </div>

      <FeatureSwitchCard
        featureKey="care_staff"
        title="Home-care staff"
        whenOn="Providers can sign up as home-care staff, and elders and families see approved people under Services."
        initialOn={data.enabled}
      />

      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'waiting' ? 'primary' : 'outline'} onClick={() => setFilter('waiting')}>
          Waiting for a check ({waiting})
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
          All ({data.listings.length})
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-text-secondary">{filter === 'waiting' ? 'Nobody is waiting for a check.' : 'No one has been sent to EC yet.'}</p>
      ) : (
        shown.map((l) => (
          <ReviewCard
            key={l.id}
            listing={l}
            onChange={(u) => setData((d) => (d ? { ...d, listings: d.listings.map((x) => (x.id === u.id ? u : x)) } : d))}
          />
        ))
      )}
    </div>
  );
}

function ReviewCard({ listing, onChange }: { listing: AdminListing; onChange: (l: AdminListing) => void }) {
  const role = staffRole(listing.role);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(listing.rates.map((r) => [r.id, String(r.approvedAmount ?? r.proposedAmount)])),
  );
  const [use, setUse] = useState<Record<string, boolean>>(Object.fromEntries(listing.rates.map((r) => [r.id, true])));
  const [months, setMonths] = useState(12);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(action: 'approve' | 'changes' | 'reject' | 'pause') {
    if (action === 'reject' && !window.confirm(`Reject ${listing.personName}? The provider sees your note.`)) return;
    setBusy(true);
    setError('');
    try {
      const approvedRates = Object.fromEntries(
        listing.rates.filter((r) => use[r.id] && Number(amounts[r.id]) > 0).map((r) => [r.id, Number(amounts[r.id])]),
      );
      const updated = await api<AdminListing>(`/admin/home-staff/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || undefined, approvedRates, months }),
      });
      onChange(updated);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const hasId = listing.documents.some((d) => d.kind === 'id_proof');
  const hasCert = listing.documents.some((d) => d.kind === 'certificate');
  const mismatch = listing.documents.some((d) => d.aiNote?.includes('does NOT match') || d.aiNote?.includes('does not look like'));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-text">{listing.personName}</p>
            <p className="text-sm text-text-secondary">
              {role?.label ?? listing.role} · via {listing.provider.businessName}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
        </div>

        {listing.provider.verificationStatus !== 'verified' && (
          <p className="flex items-center gap-2 rounded-xl bg-accent-50 p-3 text-sm text-text">
            <AlertTriangle className="h-4 w-4 text-accent-600" /> The provider account is not approved yet (Admin &gt; Providers).
          </p>
        )}
        {mismatch && (
          <p className="flex items-center gap-2 rounded-xl bg-danger-50 p-3 text-sm text-text">
            <AlertTriangle className="h-4 w-4 text-danger-600" /> The AI flagged a certificate. Please look closely.
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold text-text-secondary">Provider</dt>
          <dd className="text-text">
            {listing.provider.user.name} · {listing.provider.phone || listing.provider.user.phone || 'no phone'} · {listing.provider.user.email || ''}
            {listing.provider.serviceArea ? ` · ${listing.provider.serviceArea}` : ''}
          </dd>
          <dt className="font-semibold text-text-secondary">Aadhaar</dt>
          <dd className="text-text">{listing.aadhaarLast4 ? `XXXX XXXX ${listing.aadhaarLast4}` : 'not given'}</dd>
          {listing.qualification && (
            <>
              <dt className="font-semibold text-text-secondary">Qualification</dt>
              <dd className="text-text">{listing.qualification}</dd>
            </>
          )}
          {listing.experienceYears != null && (
            <>
              <dt className="font-semibold text-text-secondary">Experience</dt>
              <dd className="text-text">{listing.experienceYears} years</dd>
            </>
          )}
          {listing.languages && (
            <>
              <dt className="font-semibold text-text-secondary">Languages</dt>
              <dd className="text-text">{listing.languages}</dd>
            </>
          )}
          {listing.expectedSalary != null && (
            <>
              <dt className="font-semibold text-text-secondary">Expects</dt>
              <dd className="text-text">₹{listing.expectedSalary.toLocaleString('en-IN')} a month (not shown to families)</dd>
            </>
          )}
          {listing.about && (
            <>
              <dt className="font-semibold text-text-secondary">About</dt>
              <dd className="whitespace-pre-line text-text">{listing.about}</dd>
            </>
          )}
        </dl>

        <div>
          <p className="font-semibold text-text">
            Documents {hasId ? '' : '(no photo ID!)'} {role?.needsCertificate && !hasCert ? '(no certificate!)' : ''}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {listing.documents.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3 text-sm">
                <a href={`/api/v1/care-staff/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary-600 hover:underline">
                  <FileText className="h-4 w-4" /> {DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind}
                </a>{' '}
                <span className="text-text-secondary">
                  {d.fileName}
                  {d.expiresOn ? ` · valid until ${new Date(d.expiresOn).toLocaleDateString('en-IN')}` : ''}
                </span>
                {d.aiNote && (
                  <p className="mt-1 flex gap-1 text-xs text-text-secondary">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" /> {d.aiNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-text">Rates families will see</p>
          <div className="mt-2 flex flex-col gap-2">
            {listing.rates.map((r) => (
              <label key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="checkbox" checked={use[r.id] ?? false} onChange={(e) => setUse({ ...use, [r.id]: e.target.checked })} className="h-5 w-5" />
                <span className="text-text-secondary">Asked ₹{r.proposedAmount.toLocaleString('en-IN')}</span>
                <span>→ approve ₹</span>
                <Input
                  aria-label="Approved amount"
                  type="number"
                  min={1}
                  className="w-32"
                  value={amounts[r.id] ?? ''}
                  onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })}
                />
                <span className="text-text-secondary">
                  {RATE_UNIT_LABEL[r.unit as RateUnit] ?? r.unit}
                  {r.note ? ` · ${r.note}` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`m-${listing.id}`}>Check again after</Label>
            <select id={`m-${listing.id}`} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-11 rounded-xl border border-border bg-surface px-3">
              {[6, 12, 24].map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`n-${listing.id}`}>Note to the provider (needed to ask for changes or reject)</Label>
            <Input id={`n-${listing.id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The certificate photo is blurred; please upload a clear one." />
          </div>
        </div>

        {listing.verifiedUntil && listing.status === 'approved' && (
          <p className="flex items-center gap-2 text-sm text-success-600">
            <ShieldCheck className="h-4 w-4" /> Listed until {new Date(listing.verifiedUntil).toLocaleDateString('en-IN')}
          </p>
        )}
        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide('approve')} disabled={busy}>
            Approve and list
          </Button>
          <Button variant="outline" onClick={() => decide('changes')} disabled={busy}>
            Ask for changes
          </Button>
          <Button variant="outline" className="text-danger-600" onClick={() => decide('reject')} disabled={busy}>
            Reject
          </Button>
          {listing.status === 'approved' && (
            <Button variant="ghost" onClick={() => decide('pause')} disabled={busy}>
              Take off the list
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
