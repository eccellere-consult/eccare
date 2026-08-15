'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

type HomeCategory = 'leakage' | 'cleaning' | 'maid' | 'cook' | 'painting' | 'gardening' | 'electrical' | 'carpentry' | 'other';
type ElderCategory = 'home_treatment' | 'home_nursing' | 'companion_service' | 'local_errands' | 'other';
type Bucket = 'general' | 'home' | 'elder' | 'shop';

const HOME_CATEGORIES: { key: HomeCategory; label: string }[] = [
  { key: 'leakage', label: 'Leakage & plumbing' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'maid', label: 'Maid' },
  { key: 'cook', label: 'Cook' },
  { key: 'painting', label: 'Painting' },
  { key: 'gardening', label: 'Gardening' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'carpentry', label: 'Carpentry' },
  { key: 'other', label: 'Other' },
];

const ELDER_CATEGORIES: { key: ElderCategory; label: string }[] = [
  { key: 'home_treatment', label: 'Home treatment' },
  { key: 'home_nursing', label: 'Home nursing' },
  { key: 'companion_service', label: 'Companion service' },
  { key: 'local_errands', label: 'Local errands' },
  { key: 'other', label: 'Other' },
];

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string | null;
  verified: boolean;
  homeMaintenanceCategory: HomeCategory | null;
  elderCareCategory: ElderCategory | null;
  shopCategory: string | null;
}
interface Me { memberships: { role: string }[] }
interface ProviderRequest {
  id: string;
  status: 'pending' | 'communityApproved' | 'approved' | 'rejected';
  provider: {
    businessName: string;
    category: string;
    serviceArea: string | null;
    phone: string | null;
    user: { name: string; email: string | null };
  };
}

export default function VendorsPage() {
  const { data, loading, error, reload } = useCommunityData<Vendor[]>('/community/vendors');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';
  const { data: providerRequests, reload: reloadRequests } = useCommunityData<ProviderRequest[]>(
    '/community/provider-requests',
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  // Unsaved category edits, keyed by vendor id — only present while the admin has
  // touched a dropdown and not yet saved. Absent means "show whatever's on the
  // server" (via bucketOf/subCategoryOf below), so a reload cleanly drops back to
  // server truth once a save lands.
  const [pendingCategory, setPendingCategory] = useState<Record<string, { bucket: Bucket; sub?: string }>>({});
  const [categoryError, setCategoryError] = useState<Record<string, string>>({});
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

  const pendingRequests = (providerRequests ?? []).filter((r) => r.status === 'pending');

  async function decideRequest(id: string, action: 'approve' | 'reject') {
    setActionId(id);
    try {
      await communityApi.patch(`/community/provider-requests/${id}`, { action });
      reloadRequests();
    } finally {
      setActionId(null);
    }
  }

  async function verify(id: string) {
    setActionId(id);
    try {
      await communityApi.patch(`/community/vendors/${id}`, { verified: true });
      reload();
    } finally {
      setActionId(null);
    }
  }

  function bucketOf(v: Vendor): Bucket {
    if (v.homeMaintenanceCategory) return 'home';
    if (v.elderCareCategory) return 'elder';
    if (v.shopCategory) return 'shop';
    return 'general';
  }

  // The dropdowns read/write through these three helpers instead of `v` directly, so
  // an in-progress edit (picked but not yet saved) displays immediately without
  // waiting on a round trip, and a reload after a real save cleanly replaces it.
  function displayedBucket(v: Vendor): Bucket {
    return pendingCategory[v.id]?.bucket ?? bucketOf(v);
  }
  function displayedSub(v: Vendor): string {
    const pendingSub = pendingCategory[v.id]?.sub;
    if (pendingSub) return pendingSub;
    const bucket = displayedBucket(v);
    if (bucket === 'home') return v.homeMaintenanceCategory ?? HOME_CATEGORIES[0].key;
    if (bucket === 'elder') return v.elderCareCategory ?? ELDER_CATEGORIES[0].key;
    return '';
  }
  function isCategoryDirty(v: Vendor): boolean {
    return v.id in pendingCategory;
  }

  function pickBucket(v: Vendor, bucket: Bucket) {
    setPendingCategory((p) => ({ ...p, [v.id]: { bucket } }));
  }
  function pickSub(v: Vendor, sub: string) {
    setPendingCategory((p) => ({ ...p, [v.id]: { bucket: displayedBucket(v), sub } }));
  }

  /** Committee/admin re-classifies a vendor into General / Home Service / Elder Care —
   *  requires an explicit Save so a bucket pick and a sub-category refinement land as
   *  one PATCH instead of two, and so a failure (e.g. a schema change not yet live)
   *  surfaces as a visible error instead of silently doing nothing. Always sends both
   *  fields so the previous bucket's tag is explicitly cleared — enforces "at most one
   *  of the three tags set" at the call site, matching the schema's documented
   *  invariant. */
  async function saveCategory(v: Vendor) {
    const bucket = displayedBucket(v);
    const sub = displayedSub(v);
    setSavingCategoryId(v.id);
    setCategoryError((e) => ({ ...e, [v.id]: '' }));
    try {
      await communityApi.patch(`/community/vendors/${v.id}`, {
        homeMaintenanceCategory: bucket === 'home' ? sub : null,
        elderCareCategory: bucket === 'elder' ? sub : null,
      });
      setPendingCategory((p) => {
        const next = { ...p };
        delete next[v.id];
        return next;
      });
      reload();
    } catch (err) {
      setCategoryError((e) => ({ ...e, [v.id]: err instanceof Error ? err.message : 'Could not save. Please try again.' }));
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this vendor listing?')) return;
    setActionId(id);
    try {
      await communityApi.delete(`/community/vendors/${id}`);
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/vendors', {
        ...form,
        address: form.address || undefined,
      });
      setForm({ name: '', category: '', phone: '', address: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add vendor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Vendors"
      subtitle="Trusted plumbers, electricians, shops and services — all in one place."
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add vendor'}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="No vendors listed yet."
    >
      <div className="flex flex-col gap-4">
        {canManage && pendingRequests.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-100 bg-accent-50 p-4">
            <p className="text-sm font-bold text-accent-900">
              Provider requests awaiting your approval
            </p>
            {pendingRequests.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-bold text-text">{r.provider.businessName}</p>
                    <p className="text-sm text-text-secondary">
                      {r.provider.category}
                      {r.provider.serviceArea ? ` · ${r.provider.serviceArea}` : ''} · {r.provider.user.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={actionId === r.id} onClick={() => decideRequest(r.id, 'approve')}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger-600"
                      disabled={actionId === r.id}
                      onClick={() => decideRequest(r.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                {([
                  ['name', 'Business or person', 'Ramesh Electricals'],
                  ['category', 'Category', 'Electrician'],
                  ['phone', 'Phone number', '9876543210'],
                  ['address', 'Address (optional)', 'Shop 4, Main Road'],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.name || !form.category || !form.phone}>
                  {busy ? 'Adding…' : 'Add vendor'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/community/vendors/${v.id}`} className="flex items-center gap-1.5 font-bold text-text hover:underline">
                    <span className="truncate">{v.name}</span>
                    {v.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-600" />}
                  </Link>
                  {/* div, not p — Badge renders a div (invalid inside a paragraph). */}
                  <div className="mt-0.5">
                    <Badge variant="muted">{v.category}</Badge>
                    {bucketOf(v) === 'shop' && <Badge variant="muted" className="ml-1.5">Shop</Badge>}
                  </div>
                  {canManage && bucketOf(v) !== 'shop' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <select
                        aria-label={`Category for ${v.name}`}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                        value={displayedBucket(v)}
                        disabled={savingCategoryId === v.id}
                        onChange={(e) => pickBucket(v, e.target.value as Bucket)}
                      >
                        <option value="general">General Vendor</option>
                        <option value="home">Home Service</option>
                        <option value="elder">Elder Care</option>
                      </select>
                      {displayedBucket(v) === 'home' && (
                        <select
                          aria-label={`Home service category for ${v.name}`}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                          value={displayedSub(v)}
                          disabled={savingCategoryId === v.id}
                          onChange={(e) => pickSub(v, e.target.value)}
                        >
                          {HOME_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                      )}
                      {displayedBucket(v) === 'elder' && (
                        <select
                          aria-label={`Elder care category for ${v.name}`}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                          value={displayedSub(v)}
                          disabled={savingCategoryId === v.id}
                          onChange={(e) => pickSub(v, e.target.value)}
                        >
                          {ELDER_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                      )}
                      {isCategoryDirty(v) && (
                        <Button size="sm" disabled={savingCategoryId === v.id} onClick={() => saveCategory(v)}>
                          {savingCategoryId === v.id ? 'Saving…' : 'Save'}
                        </Button>
                      )}
                    </div>
                  )}
                  {categoryError[v.id] && <p className="mt-1 text-xs text-danger-600">{categoryError[v.id]}</p>}
                  {v.address && <p className="mt-1 truncate text-sm text-text-secondary">{v.address}</p>}
                  <Link href={`/community/vendors/${v.id}`} className="mt-1 inline-block text-xs font-semibold text-primary-600 hover:underline">
                    View catalog
                  </Link>
                </div>
                <a
                  href={`tel:${v.phone}`}
                  aria-label={`Call ${v.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                >
                  <Phone className="h-5 w-5" />
                </a>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {!v.verified && (
                      <Button size="sm" variant="outline" disabled={actionId === v.id} onClick={() => verify(v.id)}>
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger-600"
                      disabled={actionId === v.id}
                      onClick={() => remove(v.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CommunityPageFrame>
  );
}
