'use client';

import { useState } from 'react';
import { IndianRupee, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Me {
  memberships: { role: 'member' | 'committee' | 'admin'; neighborhood: { id: string } }[];
}

interface CommunityFee {
  id: string;
  label: string;
  defaultAmount: string;
  frequency: 'monthly' | 'one_time';
  isActive: boolean;
  createdAt: string;
}

interface FeeCharge {
  id: string;
  period: string;
  amount: string;
  status: 'due' | 'paid' | 'waived';
  dueDate: string;
  paidAt: string | null;
  resident: { name: string };
  neighborhoodMember: { flatNumber: string | null };
}

const STATUS_VARIANT = { due: 'muted', paid: 'success', waived: 'accent' } as const;

function FeeRow({ fee, onChanged }: { fee: CommunityFee; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [charges, setCharges] = useState<FeeCharge[] | null>(null);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  async function loadCharges() {
    setLoadingCharges(true);
    try {
      const data = await communityApi.get<FeeCharge[]>(`/community/fees/${fee.id}/charges`);
      setCharges(data);
    } finally {
      setLoadingCharges(false);
    }
  }

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !charges) await loadCharges();
  }

  async function generate() {
    setBusy(true);
    setMessage('');
    try {
      const result = await communityApi.post<{ period: string; chargesCreated: number; alreadyBilled: number }>(
        `/community/fees/${fee.id}/generate`,
        {},
      );
      setMessage(
        result.chargesCreated > 0
          ? `Billed ${result.chargesCreated} flat${result.chargesCreated === 1 ? '' : 's'} for ${result.period}.`
          : `Everyone was already billed for ${result.period}.`,
      );
      if (expanded) await loadCharges();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not generate charges.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await communityApi.patch(`/community/fees/${fee.id}`, { isActive: !fee.isActive });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function saveAmount(chargeId: string) {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    setBusy(true);
    try {
      await communityApi.patch(`/community/fee-charges/${chargeId}`, { amount });
      setEditingId(null);
      await loadCharges();
    } finally {
      setBusy(false);
    }
  }

  async function waive(chargeId: string) {
    if (!confirm('Waive this charge? The resident will no longer owe it.')) return;
    setBusy(true);
    try {
      await communityApi.patch(`/community/fee-charges/${chargeId}`, { status: 'waived' });
      await loadCharges();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-text">{fee.label}</p>
            <p className="text-sm text-text-secondary">
              ₹{fee.defaultAmount} · {fee.frequency === 'monthly' ? 'Monthly' : 'One-time'}
              {!fee.isActive && ' · Off'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || !fee.isActive} onClick={generate}>
              Generate this cycle&apos;s charges
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={toggleActive}>
              {fee.isActive ? 'Turn off' : 'Turn on'}
            </Button>
            <button
              onClick={toggleExpand}
              aria-label={expanded ? 'Hide charges' : 'Show charges'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-primary-50"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {message && <p className="text-sm text-text-secondary">{message}</p>}

        {expanded && (
          <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
            {loadingCharges ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (charges?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-secondary">No charges generated yet.</p>
            ) : (
              charges?.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {c.resident.name} {c.neighborhoodMember.flatNumber ? `· ${c.neighborhoodMember.flatNumber}` : ''}
                    </p>
                    <p className="text-xs text-text-secondary">{c.period}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === c.id ? (
                      <>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="h-9 w-24"
                        />
                        <Button size="sm" disabled={busy} onClick={() => saveAmount(c.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-text">₹{c.amount}</span>
                        <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                        {c.status === 'due' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditAmount(c.amount);
                              }}
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => waive(c.id)}>
                              Waive
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommunityFeesManager({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error, reload } = useCommunityData<CommunityFee[]>(`/community/fees?neighborhoodId=${neighborhoodId}`);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'one_time'>('monthly');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const defaultAmount = Number(amount);
    if (!label.trim() || Number.isNaN(defaultAmount) || defaultAmount <= 0) {
      setFormError('Please enter a label and a positive amount.');
      return;
    }
    setBusy(true);
    try {
      await communityApi.post('/community/fees', { label: label.trim(), defaultAmount, frequency });
      setLabel('');
      setAmount('');
      setFrequency('monthly');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create fee.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error) return <p className="text-danger-600">{error}</p>;

  return (
    <div className="flex flex-col gap-4">
      {!showForm ? (
        <Button size="sm" onClick={() => setShowForm(true)} className="self-start">
          <Plus className="mr-1.5 h-4 w-4" />
          New fee
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={create} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fee-label">Label</Label>
                <Input id="fee-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Monthly Maintenance" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fee-amount">Amount per flat (₹)</Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <div className="flex h-11 items-center rounded-xl bg-primary-50 p-1">
                  {(['monthly', 'one_time'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${frequency === f ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70'}`}
                    >
                      {f === 'monthly' ? 'Monthly' : 'One-time'}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p className="text-sm text-danger-600">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create fee'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {(data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
            <IndianRupee className="h-8 w-8 text-primary-600" />
            No fees set up yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.map((fee) => (
            <FeeRow key={fee.id} fee={fee} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityFeesPage() {
  const { data, loading, error } = useCommunityData<Me>('/community/me');
  const membership = data?.memberships?.[0];

  const accessError = !membership
    ? "You haven't joined a community yet."
    : membership.role === 'member'
      ? 'Only the management committee can manage fees.'
      : null;

  return (
    <CommunityPageFrame
      title="Association fees"
      subtitle="Set up maintenance and other charges, and see who's paid."
      loading={loading}
      error={error ?? accessError}
    >
      {membership && membership.role !== 'member' && <CommunityFeesManager neighborhoodId={membership.neighborhood.id} />}
    </CommunityPageFrame>
  );
}
