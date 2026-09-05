'use client';

import { useEffect, useState } from 'react';
import { Scale, FileText, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Expert {
  id: string;
  category: 'legal_will' | 'reverse_mortgage' | 'senior_insurance';
  name: string;
  firmName: string | null;
  phone: string;
  email: string | null;
  bio: string | null;
  isActive: boolean;
}
interface Document {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
}
interface Consultation {
  id: string;
  status: 'submitted' | 'in_progress' | 'completed';
  requirementDetails: Record<string, unknown>;
  notes: string | null;
  elderUser: { name: string; phone: string | null };
  documents: Document[];
}

const CATEGORY_LABEL: Record<Expert['category'], string> = {
  legal_will: 'Legal & Will Services',
  reverse_mortgage: 'Reverse Mortgage Advisory',
  senior_insurance: 'Senior Insurance',
};
const STATUS_VARIANT: Record<Consultation['status'], 'accent' | 'success' | 'muted'> = {
  submitted: 'accent',
  in_progress: 'accent',
  completed: 'success',
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

/** Self-service for a Legal Help / Insurance provider's own AdvisoryExpert
 *  profile and assigned consultations. Only shown when the provider's own
 *  category is legal_help or insurance (see app/provider/page.tsx). Not
 *  community-scoped, so unlike Auto/Taxi and Doctors there's just one
 *  profile, created automatically on verification, not per community. */
export function AdvisorySelfService({ initial }: { initial: Expert | null }) {
  const [expert, setExpert] = useState(initial);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    firmName: initial?.firmName ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    bio: initial?.bio ?? '',
  });
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function loadConsultations() {
    try {
      setConsultations(await api('/provider/advisory-expert/consultations'));
    } catch {
      /* leave empty — not critical if this fails to load */
    }
  }
  useEffect(() => {
    if (expert) loadConsultations();
  }, [expert]);

  if (!expert) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8 text-center text-text-secondary">
          Your advisory profile will appear here once EC verifies your account.
        </CardContent>
      </Card>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await api('/provider/advisory-expert', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          firmName: form.firmName.trim() || null,
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          bio: form.bio.trim() || null,
          isActive,
        }),
      });
      setExpert(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(consultationId: string, status: Consultation['status']) {
    await api(`/provider/advisory-expert/consultations/${consultationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    loadConsultations();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary-600" />
            {CATEGORY_LABEL[expert.category]}
          </CardTitle>
          <CardDescription>Families see this listing when they browse Financial, Legal &amp; Advisory Services.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ae-name">Name</Label>
              <Input id="ae-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ae-firm">Firm</Label>
              <Input id="ae-firm" value={form.firmName} onChange={(e) => setForm((f) => ({ ...f, firmName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ae-phone">Phone</Label>
              <Input id="ae-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ae-email">Email</Label>
              <Input id="ae-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="ae-bio">Bio</Label>
              <Input id="ae-bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Experience, specialisms, credentials…" />
            </div>

            <label className="flex items-center gap-2 text-sm text-text sm:col-span-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Visible in the advisor directory
            </label>

            {error && <p className="text-sm text-danger-600 sm:col-span-2">{error}</p>}

            <div className="flex items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </Button>
              {saved && <Badge variant="success">Saved</Badge>}
            </div>
          </form>
        </CardContent>
      </Card>

      {consultations.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-bold text-text">Your consultations</h2>
          {consultations.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-text">{c.elderUser.name}{c.elderUser.phone ? ` · ${c.elderUser.phone}` : ''}</p>
                  <Badge variant={STATUS_VARIANT[c.status]}>{c.status.replace('_', ' ')}</Badge>
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-primary-50 p-2 text-xs text-text-secondary">
                  {JSON.stringify(c.requirementDetails, null, 2)}
                </pre>
                {c.notes && <p className="mt-2 text-sm text-text-secondary">{c.notes}</p>}
                {c.documents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                      >
                        <FileText className="h-3 w-3" /> {doc.fileName}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['submitted', 'in_progress', 'completed'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={s === 'submitted'}
                      onClick={() => updateStatus(c.id, s)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize disabled:cursor-not-allowed disabled:opacity-50 ${c.status === s ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
