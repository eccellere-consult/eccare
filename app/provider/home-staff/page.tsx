'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Upload, UserCheck, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DOC_KINDS,
  DOC_KIND_LABEL,
  LISTING_STATUS_LABEL,
  RATE_UNITS,
  RATE_UNIT_LABEL,
  STAFF_ROLES,
  missingForSubmit,
  staffRole,
  type DocKind,
  type ListingStatus,
  type RateUnit,
} from '@/lib/care-staff';

interface Doc {
  id: string;
  kind: string;
  fileName: string;
  expiresOn: string | null;
  aiNote: string | null;
}
interface Rate {
  id: string;
  unit: string;
  proposedAmount: number;
  approvedAmount: number | null;
  note: string | null;
}
interface Listing {
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
  verifiedUntil: string | null;
  documents: Doc[];
  rates: Rate[];
}
interface PageData {
  enabled: boolean;
  provider: { businessName: string; verificationStatus: string };
  listings: Listing[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  return json.data as T;
}
const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const STATUS_VARIANT: Record<ListingStatus, 'accent' | 'success' | 'danger' | 'muted'> = {
  draft: 'muted',
  submitted: 'accent',
  changes_needed: 'danger',
  approved: 'success',
  rejected: 'danger',
  paused: 'muted',
};
const fieldClass =
  'flex w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

/**
 * Home-care staff for a provider: add each person (yourself, or each worker of an agency),
 * upload their ID proof and certificates, propose rates and send them to EC to check.
 * Families see a person only after EC approves; EC sets the rates they see.
 */
export default function ProviderHomeStaffPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api<PageData>('/provider/home-staff')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);
  useEffect(load, [load]);

  function replace(updated: Listing) {
    setData((d) => (d ? { ...d, listings: d.listings.map((l) => (l.id === updated.id ? updated : l)) } : d));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const created = await api<Listing>('/provider/home-staff', jsonInit('POST', { personName: name, role }));
      setData((d) => (d ? { ...d, listings: [...d.listings, created] } : d));
      setName('');
      setRole('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add.');
    } finally {
      setAdding(false);
    }
  }

  if (!data) return <p className="text-text-secondary">{error || 'Loading…'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <UserCheck className="h-6 w-6 text-primary-600" /> Home-care staff
        </h1>
        <p className="mt-1 text-text-secondary">
          Add each person you offer: yourself, or every worker of your agency. EC checks their documents and
          rates before families can see them.
        </p>
      </div>

      {!data.enabled && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="pt-6 text-sm text-text">
            This opens on EC&rsquo;s launch day. You can look around now; adding people starts then.
          </CardContent>
        </Card>
      )}
      {data.provider.verificationStatus !== 'verified' && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="pt-6 text-sm text-text">
            Your provider account is still being checked by EC. You can prepare your people now; they are listed
            once your account and each person are approved.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hs-name">Person&rsquo;s full name (as on their ID)</Label>
              <Input id="hs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hs-role">Work they do</Label>
              <select id="hs-role" value={role} onChange={(e) => setRole(e.target.value)} required className={`${fieldClass} h-11`}>
                <option value="">Choose…</option>
                {STAFF_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={adding || !data.enabled}>
              <Plus className="h-4 w-4" /> {adding ? 'Adding…' : 'Add person'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
        </CardContent>
      </Card>

      {data.listings.length === 0 ? (
        <p className="text-text-secondary">No one added yet.</p>
      ) : (
        data.listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onChange={replace}
            onRemoved={() => setData((d) => (d ? { ...d, listings: d.listings.filter((x) => x.id !== l.id) } : d))}
          />
        ))
      )}
    </div>
  );
}

function ListingCard({ listing, onChange, onRemoved }: { listing: Listing; onChange: (l: Listing) => void; onRemoved: () => void }) {
  const role = staffRole(listing.role);
  const [form, setForm] = useState({
    qualification: listing.qualification ?? '',
    experienceYears: listing.experienceYears?.toString() ?? '',
    languages: listing.languages ?? '',
    about: listing.about ?? '',
    aadhaar: '',
    expectedSalary: listing.expectedSalary?.toString() ?? '',
  });
  const [rates, setRates] = useState(
    listing.rates.length
      ? listing.rates.map((r) => ({ unit: r.unit as RateUnit, amount: String(r.proposedAmount), note: r.note ?? '' }))
      : [{ unit: role?.defaultUnit ?? ('month' as RateUnit), amount: '', note: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [docKind, setDocKind] = useState<DocKind>('id_proof');
  const [docExpiry, setDocExpiry] = useState('');
  const [uploading, setUploading] = useState(false);

  const locked = listing.status === 'rejected';
  const listed = listing.status === 'approved' || listing.status === 'paused';

  function payload() {
    return {
      qualification: form.qualification.trim() || null,
      experienceYears: form.experienceYears.trim() ? Math.round(Number(form.experienceYears)) : null,
      languages: form.languages.trim() || null,
      about: form.about.trim() || null,
      ...(form.aadhaar.trim() ? { aadhaar: form.aadhaar.trim() } : {}),
      expectedSalary: form.expectedSalary.trim() ? Number(form.expectedSalary) : null,
      rates: rates
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({ unit: r.unit, amount: Number(r.amount), note: r.note.trim() || null })),
    };
  }

  async function save(action: 'save' | 'submit' | 'pause' | 'resume') {
    if (action === 'save' && listed && !window.confirm('Changing a listed person hides them until EC checks again. Continue?')) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = action === 'pause' || action === 'resume' ? { action } : { ...payload(), action };
      const updated = await api<Listing>(`/provider/home-staff/${listing.id}`, jsonInit('PATCH', body));
      onChange(updated);
      setForm((f) => ({ ...f, aadhaar: '' }));
      setMsg(action === 'submit' ? 'Sent to EC. We will check and let you know here.' : 'Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${listing.personName} and all their documents? This cannot be undone.`)) return;
    try {
      await api(`/provider/home-staff/${listing.id}`, { method: 'DELETE' });
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove.');
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', docKind);
      if (docExpiry) body.append('expiresOn', docExpiry);
      onChange(await api<Listing>(`/provider/home-staff/${listing.id}/documents`, { method: 'POST', body }));
      setDocExpiry('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(docId: string) {
    if (!window.confirm('Remove this document?')) return;
    try {
      onChange(await api<Listing>(`/provider/home-staff/${listing.id}/documents/${docId}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove.');
    }
  }

  const missing = missingForSubmit({
    personName: listing.personName,
    role: listing.role,
    aadhaarLast4: form.aadhaar.trim() ? form.aadhaar.replace(/\D/g, '').slice(-4) : listing.aadhaarLast4,
    documents: listing.documents,
    rates: rates.map((r) => ({ proposedAmount: Number(r.amount) || 0 })),
  });
  const showSalary = role?.engagement === 'full_time' || role?.engagement === 'part_time';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-text">{listing.personName}</p>
            <p className="text-sm text-text-secondary">{role?.label ?? listing.role}</p>
          </div>
          <Badge variant={STATUS_VARIANT[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
        </div>

        {listing.status === 'approved' && listing.verifiedUntil && (
          <p className="flex items-center gap-2 text-sm text-success-600">
            <ShieldCheck className="h-4 w-4" /> EC verified until {new Date(listing.verifiedUntil).toLocaleDateString('en-IN')}
          </p>
        )}
        {listing.adminNote && (
          <p className="rounded-xl bg-accent-50 p-3 text-sm text-text">
            <span className="font-semibold">Note from EC:</span> {listing.adminNote}
          </p>
        )}

        <fieldset disabled={locked || busy} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`q-${listing.id}`}>Qualification</Label>
            <Input id={`q-${listing.id}`} value={form.qualification} maxLength={120} placeholder={role?.needsCertificate ? 'e.g. GNM, B.Sc Nursing, MBBS' : 'Optional'} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`x-${listing.id}`}>Years of experience</Label>
            <Input id={`x-${listing.id}`} type="number" min={0} max={60} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`l-${listing.id}`}>Languages they speak</Label>
            <Input id={`l-${listing.id}`} value={form.languages} maxLength={120} placeholder="e.g. Malayalam, English, Hindi" onChange={(e) => setForm({ ...form, languages: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`a-${listing.id}`}>Aadhaar: last 4 digits only</Label>
            <Input
              id={`a-${listing.id}`}
              inputMode="numeric"
              maxLength={4}
              value={form.aadhaar}
              placeholder={listing.aadhaarLast4 ? `Saved: XXXX XXXX ${listing.aadhaarLast4}` : '1234'}
              onChange={(e) => setForm({ ...form, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
            <p className="text-xs text-text-secondary">EC never keeps the full Aadhaar number.</p>
          </div>
          {showSalary && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`s-${listing.id}`}>Expected monthly salary, ₹ (optional)</Label>
              <Input id={`s-${listing.id}`} type="number" min={0} value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor={`b-${listing.id}`}>About them (shown to families)</Label>
            <textarea id={`b-${listing.id}`} rows={2} maxLength={1000} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} className={fieldClass} placeholder="e.g. Cares for bedridden patients, gives insulin, night duty possible" />
          </div>
        </fieldset>

        <div>
          <p className="font-semibold text-text">Rates you propose</p>
          <p className="text-xs text-text-secondary">EC approves the rate families see. You can give more than one (e.g. per visit and per month).</p>
          <div className="mt-2 flex flex-col gap-2">
            {rates.map((r, i) => {
              const approved = listing.rates.find((x) => x.unit === r.unit)?.approvedAmount;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-text-secondary">₹</span>
                  <Input
                    aria-label="Amount in rupees"
                    type="number"
                    min={1}
                    className="w-32"
                    value={r.amount}
                    disabled={locked}
                    onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  />
                  <select
                    aria-label="Charged"
                    value={r.unit}
                    disabled={locked}
                    onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, unit: e.target.value as RateUnit } : x)))}
                    className={`${fieldClass} h-11 w-36`}
                  >
                    {RATE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {RATE_UNIT_LABEL[u]}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label="Note"
                    className="min-w-0 flex-1"
                    placeholder="Note (optional), e.g. 12-hour day shift"
                    maxLength={80}
                    value={r.note}
                    disabled={locked}
                    onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  />
                  {approved != null && <Badge variant="success">EC approved ₹{approved.toLocaleString('en-IN')}</Badge>}
                  {rates.length > 1 && !locked && (
                    <Button variant="ghost" size="icon" aria-label="Remove this rate" onClick={() => setRates(rates.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {rates.length < 6 && !locked && (
              <Button variant="link" size="sm" className="self-start" onClick={() => setRates([...rates, { unit: 'month', amount: '', note: '' }])}>
                <Plus className="h-4 w-4" /> Add another rate
              </Button>
            )}
          </div>
        </div>

        <div>
          <p className="font-semibold text-text">Documents</p>
          <p className="text-xs text-text-secondary">
            Needed: a photo ID (Voter ID, PAN, driving licence, passport, or the <em>masked</em> Aadhaar from the UIDAI
            website, never a full Aadhaar copy){role?.needsCertificate ? `, and ${role.certificateHint.toLowerCase()}` : ''}. Police
            verification is welcome. Only you and EC can open these.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {listing.documents.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-primary-600" />
                  <a href={`/api/v1/care-staff/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-semibold text-primary-600 hover:underline">
                    {DOC_KIND_LABEL[d.kind as DocKind] ?? d.kind}
                  </a>
                  <span className="text-sm text-text-secondary">{d.fileName}</span>
                  {d.expiresOn && <span className="text-sm text-text-secondary">· valid until {new Date(d.expiresOn).toLocaleDateString('en-IN')}</span>}
                  {!locked && (
                    <Button variant="ghost" size="icon" aria-label="Remove document" className="ml-auto" onClick={() => removeDoc(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {d.aiNote && (
                  <p className="mt-1 flex gap-1 text-xs text-text-secondary">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" /> {d.aiNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {!locked && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`dk-${listing.id}`}>Document</Label>
                <select id={`dk-${listing.id}`} value={docKind} onChange={(e) => setDocKind(e.target.value as DocKind)} className={`${fieldClass} h-11`}>
                  {DOC_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {DOC_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`de-${listing.id}`}>Valid until (if printed)</Label>
                <Input id={`de-${listing.id}`} type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
              </div>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 font-semibold text-primary-600 hover:bg-primary-50">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload (PDF or photo)'}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={upload} />
              </label>
            </div>
          )}
          {docKind === 'certificate' && !locked && (
            <p className="mt-1 text-xs text-text-secondary">A photo of a certificate is read by EC&rsquo;s AI to help our check. ID proofs are never sent to the AI.</p>
          )}
        </div>

        {!locked && missing.length > 0 && listing.status !== 'submitted' && (
          <div className="rounded-xl bg-primary-50 p-3 text-sm text-text">
            <p className="font-semibold">Before sending to EC, add:</p>
            <ul className="ml-5 list-disc">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}
        {msg && <p className="text-sm text-success-600">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button variant="outline" onClick={() => save('save')} disabled={busy}>
              Save
            </Button>
          )}
          {(listing.status === 'draft' || listing.status === 'changes_needed') && (
            <Button onClick={() => save('submit')} disabled={busy || missing.length > 0}>
              Send to EC for checking
            </Button>
          )}
          {listing.status === 'approved' && (
            <Button variant="outline" onClick={() => save('pause')} disabled={busy}>
              Pause (not available now)
            </Button>
          )}
          {listing.status === 'paused' && (
            <Button onClick={() => save('resume')} disabled={busy}>
              Available again
            </Button>
          )}
          <Button variant="ghost" className="text-danger-600" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
