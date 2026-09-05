'use client';

import { useEffect, useState } from 'react';
import { Home, Plus, Trash2, Upload, Save, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type ChecklistStatus = 'pass' | 'fail' | 'needs_attention';
interface RateProfile {
  monthlyFee: string | null;
  quarterlyFee: string | null;
  biannualFee: string | null;
}
interface Client {
  id: string;
  frequency: 'monthly' | 'quarterly' | 'biannually';
  elderUser: { id: string; name: string; address: string | null; city: string | null; phone: string | null };
  inspections: { inspectedAt: string }[];
}
interface RepairLine {
  itemDescription: string;
  estimatedCost: string;
}

const CHECKLIST_FIELDS: { key: 'plumbingStatus' | 'electricalStatus' | 'structuralStatus'; label: string }[] = [
  { key: 'plumbingStatus', label: 'Plumbing' },
  { key: 'electricalStatus', label: 'Electrical' },
  { key: 'structuralStatus', label: 'Structural' },
];

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

/** Self-service for a Property Management provider — their own rates,
 *  client list, and inspection submission. Only shown when the provider's
 *  own category is property_management (see app/provider/page.tsx). This
 *  is the one module where self-service also changes the elder-facing
 *  workflow: families now pick this specific provider (Services > Property
 *  Management) rather than a generic plan, and this provider's own account
 *  submits inspections directly — the admin-proxy field-agent path stays
 *  only for the legacy generic subscriptions that predate provider choice. */
export function PropertyManagementSelfService({ initialProfile }: { initialProfile: RateProfile | null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [rateForm, setRateForm] = useState({
    monthlyFee: initialProfile?.monthlyFee ?? '',
    quarterlyFee: initialProfile?.quarterlyFee ?? '',
    biannualFee: initialProfile?.biannualFee ?? '',
  });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);
  const [rateError, setRateError] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [checklist, setChecklist] = useState<Record<string, ChecklistStatus>>({
    plumbingStatus: 'pass',
    electricalStatus: 'pass',
    structuralStatus: 'pass',
  });
  const [notes, setNotes] = useState('');
  const [repairs, setRepairs] = useState<RepairLine[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  async function loadClients() {
    setLoadingClients(true);
    try {
      setClients(await api('/provider/property-management/subscriptions'));
    } catch {
      /* leave empty — not critical if this fails to load */
    } finally {
      setLoadingClients(false);
    }
  }
  useEffect(() => {
    loadClients();
  }, []);

  if (!profile) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8 text-center text-text-secondary">
          Your rate profile will appear here once EC verifies your account.
        </CardContent>
      </Card>
    );
  }

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    setSavingRates(true);
    setRatesSaved(false);
    setRateError('');
    try {
      const updated = await api('/provider/property-management/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          monthlyFee: rateForm.monthlyFee ? Number(rateForm.monthlyFee) : null,
          quarterlyFee: rateForm.quarterlyFee ? Number(rateForm.quarterlyFee) : null,
          biannualFee: rateForm.biannualFee ? Number(rateForm.biannualFee) : null,
        }),
      });
      setProfile(updated);
      setRatesSaved(true);
      setTimeout(() => setRatesSaved(false), 2000);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : 'Could not save rates.');
    } finally {
      setSavingRates(false);
    }
  }

  function addRepairLine() {
    setRepairs((r) => [...r, { itemDescription: '', estimatedCost: '' }]);
  }
  function updateRepairLine(i: number, patch: Partial<RepairLine>) {
    setRepairs((r) => r.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }
  function removeRepairLine(i: number) {
    setRepairs((r) => r.filter((_, idx) => idx !== i));
  }

  async function submitInspection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const validRepairs = repairs
        .filter((r) => r.itemDescription.trim() && r.estimatedCost)
        .map((r) => ({ itemDescription: r.itemDescription.trim(), estimatedCost: Number(r.estimatedCost) }));

      const inspection = await api('/provider/property-management/inspections', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: selectedClientId,
          ...checklist,
          notes: notes.trim() || undefined,
          repairEstimates: validRepairs.length ? validRepairs : undefined,
        }),
      });

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`/api/v1/provider/property-management/inspections/${inspection.id}/media`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      setSubmitSuccess('Inspection report submitted.');
      setSelectedClientId('');
      setChecklist({ plumbingStatus: 'pass', electricalStatus: 'pass', structuralStatus: 'pass' });
      setNotes('');
      setRepairs([]);
      setFiles([]);
      loadClients();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary-600" />
            Your rates
          </CardTitle>
          <CardDescription>Families see these when they browse Services &gt; Property Management.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveRates} className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pm-monthly">Monthly (₹)</Label>
              <Input id="pm-monthly" type="number" min="0" value={rateForm.monthlyFee} onChange={(e) => setRateForm((f) => ({ ...f, monthlyFee: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pm-quarterly">Quarterly (₹)</Label>
              <Input id="pm-quarterly" type="number" min="0" value={rateForm.quarterlyFee} onChange={(e) => setRateForm((f) => ({ ...f, quarterlyFee: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pm-biannual">Bi-annual (₹)</Label>
              <Input id="pm-biannual" type="number" min="0" value={rateForm.biannualFee} onChange={(e) => setRateForm((f) => ({ ...f, biannualFee: e.target.value }))} />
            </div>
            {rateError && <p className="text-sm text-danger-600 sm:col-span-3">{rateError}</p>}
            <div className="flex items-center gap-2 sm:col-span-3">
              <Button type="submit" disabled={savingRates}>
                <Save className="h-4 w-4" /> {savingRates ? 'Saving…' : 'Save rates'}
              </Button>
              {ratesSaved && <Badge variant="success">Saved</Badge>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary-600" />
            Submit an inspection report
          </CardTitle>
          <CardDescription>Pick one of your clients, fill in the checklist, and add repair estimates if needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingClients ? (
            <p className="text-text-secondary">Loading your clients…</p>
          ) : clients.length === 0 ? (
            <p className="text-text-secondary">No families have subscribed to you yet.</p>
          ) : (
            <form onSubmit={submitInspection} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="pm-client">Client</Label>
                <select
                  id="pm-client"
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.elderUser.name} — {[c.elderUser.address, c.elderUser.city].filter(Boolean).join(', ') || 'No address on file'} ({c.frequency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {CHECKLIST_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <Label htmlFor={`pm-${field.key}`}>{field.label}</Label>
                    <select
                      id={`pm-${field.key}`}
                      value={checklist[field.key]}
                      onChange={(e) => setChecklist((c) => ({ ...c, [field.key]: e.target.value as ChecklistStatus }))}
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    >
                      <option value="pass">Pass</option>
                      <option value="needs_attention">Needs attention</option>
                      <option value="fail">Fail</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="pm-notes">Notes (optional)</Label>
                <textarea
                  id="pm-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="pm-media">Photos / videos (optional)</Label>
                <label htmlFor="pm-media" className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-text-secondary hover:border-primary-600">
                  <Upload className="h-4 w-4" /> {files.length > 0 ? `${files.length} file(s) selected` : 'Choose files'}
                </label>
                <input
                  id="pm-media"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-text">Repair estimates (optional)</p>
                  <Button type="button" size="sm" variant="outline" onClick={addRepairLine}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                </div>
                {repairs.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Item description" value={line.itemDescription} onChange={(e) => updateRepairLine(i, { itemDescription: e.target.value })} className="flex-1" />
                    <Input type="number" placeholder="Cost ₹" value={line.estimatedCost} onChange={(e) => updateRepairLine(i, { estimatedCost: e.target.value })} className="w-32" />
                    <button type="button" onClick={() => removeRepairLine(i)} aria-label="Remove" className="text-text-secondary hover:text-danger-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {submitError && <p className="text-sm text-danger-600">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-success-600">{submitSuccess}</p>}

              <Button type="submit" disabled={submitting || !selectedClientId} className="w-fit">
                {submitting ? 'Submitting…' : 'Submit inspection report'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
