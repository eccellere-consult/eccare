'use client';

import { useState } from 'react';
import { Home, Plus, Trash2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

type ChecklistStatus = 'pass' | 'fail' | 'needs_attention';
interface Subscription {
  id: string;
  frequency: 'monthly' | 'quarterly' | 'biannually';
  elderUser: { id: string; name: string; address: string | null; city: string | null };
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

export default function AdminPropertyPage() {
  const { data: subscriptions, loading } = useCommunityData<Subscription[]>('/admin/property-subscriptions');
  const [selectedId, setSelectedId] = useState('');
  const [checklist, setChecklist] = useState<Record<string, ChecklistStatus>>({
    plumbingStatus: 'pass',
    electricalStatus: 'pass',
    structuralStatus: 'pass',
  });
  const [notes, setNotes] = useState('');
  const [repairs, setRepairs] = useState<RepairLine[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function addRepairLine() {
    setRepairs((r) => [...r, { itemDescription: '', estimatedCost: '' }]);
  }
  function updateRepairLine(i: number, patch: Partial<RepairLine>) {
    setRepairs((r) => r.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }
  function removeRepairLine(i: number) {
    setRepairs((r) => r.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const validRepairs = repairs
        .filter((r) => r.itemDescription.trim() && r.estimatedCost)
        .map((r) => ({ itemDescription: r.itemDescription.trim(), estimatedCost: Number(r.estimatedCost) }));

      const inspection = await communityApi.post<{ id: string }>('/admin/property-inspections', {
        subscriptionId: selectedId,
        ...checklist,
        notes: notes.trim() || undefined,
        repairEstimates: validRepairs.length ? validRepairs : undefined,
      });

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`/api/v1/admin/property-inspections/${inspection.id}/media`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      setSuccess('Inspection report submitted.');
      setSelectedId('');
      setChecklist({ plumbingStatus: 'pass', electricalStatus: 'pass', structuralStatus: 'pass' });
      setNotes('');
      setRepairs([]);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Property Management</h1>
      <p className="mt-1 text-text-secondary">Submit an inspection report on behalf of a field agent — agents don't have EC accounts.</p>

      {loading ? (
        <p className="mt-4 text-text-secondary">Loading…</p>
      ) : subscriptions?.length === 0 ? (
        <Card className="mt-4"><CardContent className="py-12 text-center text-text-secondary">No active property subscriptions yet.</CardContent></Card>
      ) : (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="p-sub">Property</Label>
                <select
                  id="p-sub"
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <option value="">Select a property…</option>
                  {subscriptions?.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.elderUser.name} — {[sub.elderUser.address, sub.elderUser.city].filter(Boolean).join(', ') || 'No address on file'} ({sub.frequency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {CHECKLIST_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <select
                      id={field.key}
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
                <Label htmlFor="p-notes">Notes (optional)</Label>
                <textarea
                  id="p-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="p-media">Photos / videos (optional)</Label>
                <label htmlFor="p-media" className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-text-secondary hover:border-primary-600">
                  <Upload className="h-4 w-4" /> {files.length > 0 ? `${files.length} file(s) selected` : 'Choose files'}
                </label>
                <input
                  id="p-media"
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
                    <Input
                      placeholder="Item description"
                      value={line.itemDescription}
                      onChange={(e) => updateRepairLine(i, { itemDescription: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Cost ₹"
                      value={line.estimatedCost}
                      onChange={(e) => updateRepairLine(i, { estimatedCost: e.target.value })}
                      className="w-32"
                    />
                    <button type="button" onClick={() => removeRepairLine(i)} aria-label="Remove" className="text-text-secondary hover:text-danger-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-danger-600">{error}</p>}
              {success && <p className="text-sm text-success-600">{success}</p>}

              <Button type="submit" disabled={saving || !selectedId} className="w-fit">
                {saving ? 'Submitting…' : 'Submit inspection report'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex items-center gap-2 text-sm text-text-secondary">
        <Home className="h-4 w-4" /> Elders and family manage subscriptions and pay invoices from{' '}
        <Badge variant="muted">Services → Property Management</Badge>.
      </div>
    </div>
  );
}
