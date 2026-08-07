'use client';

import { useEffect, useState } from 'react';
import { Phone, Clock, ImagePlus, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Listing {
  id: string;
  listingType: 'sell' | 'rent' | 'lend' | 'wanted';
  title: string;
  description: string | null;
  price: string | null;
  priceUnit: string | null;
  imagePath: string | null;
  contactPhone: string;
  preferredContactTime: string | null;
  status: 'active' | 'reserved' | 'closed';
  postedBy: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

const TABS: { key: Listing['listingType']; label: string }[] = [
  { key: 'sell', label: 'Sell' },
  { key: 'rent', label: 'Rent' },
  { key: 'lend', label: 'Lend' },
  { key: 'wanted', label: 'Wanted' },
];

const STATUS_VARIANT: Record<Listing['status'], 'success' | 'muted' | 'danger'> = {
  active: 'success',
  reserved: 'muted',
  closed: 'danger',
};

const EMPTY_FORM = {
  listingType: 'sell' as Listing['listingType'],
  title: '',
  description: '',
  price: '',
  priceUnit: '',
  contactPhone: '',
  preferredContactTime: '',
};

export default function MarketplacePage() {
  const { data, loading, error, reload } = useCommunityData<Listing[]>('/community/marketplace');
  const { data: me } = useCommunityData<Me>('/community/me');
  const myUserRole = me?.memberships?.[0]?.role;
  const canManageAny = myUserRole === 'committee' || myUserRole === 'admin';
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMyUserId(j.data.id); })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<Listing['listingType']>('sell');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const filtered = (data ?? []).filter((l) => l.listingType === activeTab);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const price = form.price ? parseFloat(form.price) : undefined;
      if (form.price && (Number.isNaN(price) || (price ?? 0) <= 0)) {
        throw new Error('Please enter a valid price.');
      }
      await communityApi.post('/community/marketplace', {
        listingType: form.listingType,
        title: form.title,
        description: form.description || undefined,
        price,
        priceUnit: form.priceUnit || undefined,
        contactPhone: form.contactPhone,
        preferredContactTime: form.preferredContactTime || undefined,
      });
      setForm({ ...EMPTY_FORM, listingType: activeTab });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not post listing.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Listing['status']) {
    setActionId(id);
    try {
      await communityApi.patch(`/community/marketplace/${id}`, { status });
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this listing?')) return;
    setActionId(id);
    try {
      await communityApi.delete(`/community/marketplace/${id}`);
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function uploadImage(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/v1/community/marketplace/${id}/image`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Upload failed.');
      reload();
    } catch {
      /* keep it simple — a failed photo upload doesn't need its own alert banner */
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  }

  return (
    <CommunityPageFrame
      title="Buy, sell, rent & lend"
      subtitle="Sell something old, lend a tool, rent out an item, or ask if anyone has what you need."
      action={<Button onClick={() => { setForm({ ...EMPTY_FORM, listingType: activeTab }); setShowForm((s) => !s); }}>{showForm ? 'Cancel' : 'Post a listing'}</Button>}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={activeTab === t.key ? 'primary' : 'outline'}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mp-type">Listing type</Label>
                  <select
                    id="mp-type"
                    value={form.listingType}
                    onChange={(e) => setForm((f) => ({ ...f, listingType: e.target.value as Listing['listingType'] }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {TABS.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mp-title">Title</Label>
                  <Input id="mp-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Foldable wheelchair, like new" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mp-desc">Description (optional)</Label>
                  <Input id="mp-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Used for 3 months, well maintained" />
                </div>
                {form.listingType !== 'wanted' && form.listingType !== 'lend' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mp-price">Price (₹)</Label>
                      <Input id="mp-price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="1500" inputMode="decimal" />
                    </div>
                    {form.listingType === 'rent' && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="mp-unit">Price unit (optional)</Label>
                        <Input id="mp-unit" value={form.priceUnit} onChange={(e) => setForm((f) => ({ ...f, priceUnit: e.target.value }))} placeholder="per day" />
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mp-phone">Contact number</Label>
                    <Input id="mp-phone" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="9876543210" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mp-time">Preferred contact time (optional)</Label>
                    <Input id="mp-time" value={form.preferredContactTime} onChange={(e) => setForm((f) => ({ ...f, preferredContactTime: e.target.value }))} placeholder="Evenings after 6pm" />
                  </div>
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.title || !form.contactPhone} className="self-start">
                  {busy ? 'Posting…' : 'Post listing'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              Nothing posted here yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                isOwner={l.postedBy.id === myUserId}
                canManageAny={canManageAny}
                actionBusy={actionId === l.id}
                uploading={uploadingId === l.id}
                onStatus={setStatus}
                onRemove={remove}
                onUpload={uploadImage}
              />
            ))}
          </div>
        )}
      </div>
    </CommunityPageFrame>
  );
}

function ListingCard({
  listing,
  isOwner,
  canManageAny,
  actionBusy,
  uploading,
  onStatus,
  onRemove,
  onUpload,
}: {
  listing: Listing;
  isOwner: boolean;
  canManageAny: boolean;
  actionBusy: boolean;
  uploading: boolean;
  onStatus: (id: string, status: Listing['status']) => void;
  onRemove: (id: string) => void;
  onUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card>
      <CardContent className="flex gap-4 pt-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50">
          {listing.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imagePath} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <Tag className="h-8 w-8 text-primary-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-text">{listing.title}</p>
            <Badge variant={STATUS_VARIANT[listing.status]}>{listing.status}</Badge>
          </div>
          {listing.price && (
            <p className="text-sm font-semibold text-primary-900">
              ₹{listing.price}{listing.priceUnit ? ` ${listing.priceUnit}` : ''}
            </p>
          )}
          {listing.description && <p className="mt-1 text-sm text-text-secondary">{listing.description}</p>}
          <p className="mt-1 text-xs text-text-secondary">Posted by {listing.postedBy.name}</p>
          {listing.preferredContactTime && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
              <Clock className="h-3.5 w-3.5" />
              {listing.preferredContactTime}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`tel:${listing.contactPhone}`}
              className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
            {isOwner && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                <ImagePlus className="h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : 'Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onUpload(listing.id, e)}
                />
              </label>
            )}
            {isOwner && listing.status !== 'closed' && (
              <>
                {listing.status === 'active' && (
                  <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => onStatus(listing.id, 'reserved')}>
                    Mark reserved
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => onStatus(listing.id, 'closed')}>
                  Mark closed
                </Button>
              </>
            )}
            {(isOwner || canManageAny) && (
              <Button size="sm" variant="outline" className="text-danger-600" disabled={actionBusy} onClick={() => onRemove(listing.id)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
