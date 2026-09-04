'use client';

import { useState } from 'react';
import { Scale, Home, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

type Category = 'legal_will' | 'reverse_mortgage' | 'senior_insurance';
interface Expert {
  id: string;
  category: Category;
  name: string;
  firmName: string | null;
  phone: string;
  email: string | null;
  bio: string | null;
  isActive: boolean;
}
interface Consultation {
  id: string;
  category: Category;
  status: 'submitted' | 'in_progress' | 'completed';
  notes: string | null;
  requirementDetails: Record<string, unknown>;
  assignedExpert: Expert | null;
  createdAt: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Scale }> = {
  legal_will: { label: 'Legal & Will Services', icon: Scale },
  reverse_mortgage: { label: 'Reverse Mortgage Advisory', icon: Home },
  senior_insurance: { label: 'Senior Insurance', icon: ShieldCheck },
};
const STATUS_VARIANT: Record<Consultation['status'], 'accent' | 'success' | 'muted'> = {
  submitted: 'accent',
  in_progress: 'accent',
  completed: 'success',
};

const EMPTY_FORM = { category: 'legal_will' as Category, name: '', firmName: '', phone: '', email: '', bio: '' };

export default function AdminAdvisoryPage() {
  const [tab, setTab] = useState<'experts' | 'requests'>('requests');
  const { data: experts, loading: expertsLoading, reload: reloadExperts } = useCommunityData<Expert[]>('/admin/advisory/experts');
  const { data: requests, loading: requestsLoading, reload: reloadRequests } = useCommunityData<Consultation[]>('/admin/advisory/consultations');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function addExpert(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await communityApi.post('/admin/advisory/experts', {
        category: form.category,
        name: form.name.trim(),
        firmName: form.firmName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      reloadExperts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add expert.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(expert: Expert) {
    await communityApi.patch(`/admin/advisory/experts/${expert.id}`, { isActive: !expert.isActive });
    reloadExperts();
  }

  async function removeExpert(id: string) {
    if (!confirm('Remove this advisor?')) return;
    await communityApi.delete(`/admin/advisory/experts/${id}`);
    reloadExperts();
  }

  async function assignExpert(consultationId: string, expertId: string) {
    await communityApi.patch(`/advisory/consultations/${consultationId}`, { assignedExpertId: expertId || null });
    reloadRequests();
  }

  async function updateStatus(consultationId: string, status: Consultation['status']) {
    await communityApi.patch(`/advisory/consultations/${consultationId}`, { status });
    reloadRequests();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Financial, Legal &amp; Advisory Services</h1>
      <p className="mt-1 text-text-secondary">Manage the advisor directory and coordinate consultation requests.</p>

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant={tab === 'requests' ? 'primary' : 'outline'} onClick={() => setTab('requests')}>Consultation requests</Button>
        <Button size="sm" variant={tab === 'experts' ? 'primary' : 'outline'} onClick={() => setTab('experts')}>Advisor directory</Button>
      </div>

      {tab === 'experts' && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add advisor'}
          </Button>
          {showForm && (
            <Card className="mt-2">
              <CardContent className="pt-6">
                <form onSubmit={addExpert} className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-cat">Category</Label>
                    <select
                      id="e-cat"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    >
                      {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-name">Name</Label>
                    <Input id="e-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-firm">Firm (optional)</Label>
                    <Input id="e-firm" value={form.firmName} onChange={(e) => setForm((f) => ({ ...f, firmName: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-phone">Phone</Label>
                    <Input id="e-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="e-email">Email (optional)</Label>
                    <Input id="e-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor="e-bio">Bio (optional)</Label>
                    <Input id="e-bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
                  </div>
                  {formError && <p className="text-sm text-danger-600 sm:col-span-2">{formError}</p>}
                  <Button type="submit" disabled={saving || !form.name.trim() || !form.phone.trim()} className="w-fit sm:col-span-2">
                    {saving ? 'Adding…' : 'Add advisor'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {expertsLoading ? (
              <p className="text-text-secondary">Loading…</p>
            ) : experts?.length === 0 ? (
              <Card className="sm:col-span-2"><CardContent className="py-12 text-center text-text-secondary">No advisors added yet.</CardContent></Card>
            ) : (
              experts?.map((expert) => {
                const Icon = CATEGORY_META[expert.category].icon;
                return (
                  <Card key={expert.id} className={expert.isActive ? '' : 'opacity-60'}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                            <Icon className="h-5 w-5 text-primary-600" />
                          </span>
                          <div>
                            <p className="font-bold text-text">{expert.name}</p>
                            <p className="text-xs text-text-secondary">{CATEGORY_META[expert.category].label}{expert.firmName ? ` · ${expert.firmName}` : ''}</p>
                          </div>
                        </div>
                        <button onClick={() => removeExpert(expert.id)} aria-label="Remove" className="text-text-secondary hover:text-danger-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">{expert.phone}{expert.email ? ` · ${expert.email}` : ''}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => toggleActive(expert)}>
                        {expert.isActive ? 'Hide from directory' : 'Show in directory'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="mt-4 flex flex-col gap-3">
          {requestsLoading ? (
            <p className="text-text-secondary">Loading…</p>
          ) : requests?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-text-secondary">No consultation requests yet.</CardContent></Card>
          ) : (
            requests?.map((req) => (
              <Card key={req.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-bold text-text">{CATEGORY_META[req.category].label}</p>
                    <Badge variant={STATUS_VARIANT[req.status]}>{req.status.replace('_', ' ')}</Badge>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-primary-50 p-2 text-xs text-text-secondary">
                    {JSON.stringify(req.requirementDetails, null, 2)}
                  </pre>
                  {req.notes && <p className="mt-2 text-sm text-text-secondary">{req.notes}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={req.assignedExpert?.id ?? ''}
                      onChange={(e) => assignExpert(req.id, e.target.value)}
                      className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-text"
                    >
                      <option value="">Assign an advisor…</option>
                      {experts?.filter((ex) => ex.category === req.category).map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                    {(['submitted', 'in_progress', 'completed'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(req.id, s)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize ${req.status === s ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
