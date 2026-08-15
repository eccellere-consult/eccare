'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Wrench, BadgeCheck, UserPlus, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

type HomeCategory = 'leakage' | 'cleaning' | 'maid' | 'cook' | 'painting' | 'gardening' | 'electrical' | 'carpentry' | 'other';

const CATEGORIES: { key: HomeCategory; label: string }[] = [
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

interface Vendor {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  verified: boolean;
  homeMaintenanceCategory: HomeCategory | null;
}
interface Me { memberships: { role: 'member' | 'committee' | 'admin' }[] }

export default function HomeServicesPage() {
  // Explicit param (even empty) is what the server now uses to disambiguate this
  // view from the plain Vendors list — see app/api/v1/community/vendors/route.ts.
  const { data, loading, error, reload } = useCommunityData<Vendor[]>('/community/vendors?homeMaintenanceCategory=');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role === 'committee' || me?.memberships?.[0]?.role === 'admin';

  const [myRole, setMyRole] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMyRole(j.data.role); })
      .catch(() => {});
  }, []);
  const contactsHref = myRole === 'elder' ? '/elder/contacts' : '/family/contacts';

  const [activeCategory, setActiveCategory] = useState<HomeCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'leakage' as HomeCategory, phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const filtered = (data ?? []).filter((v) => v.homeMaintenanceCategory && (!activeCategory || v.homeMaintenanceCategory === activeCategory));
  // Split into two easy-to-scan sections: committee/admin-curated listings the
  // community can trust outright, and ones a resident suggested via their own
  // Contacts (see contact-form.tsx) — unverified, but still worth surfacing
  // rather than burying in the general Vendors directory where this category
  // tag isn't visible at all.
  const verifiedListings = filtered.filter((v) => v.verified);
  const suggestedListings = filtered.filter((v) => !v.verified);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/vendors', {
        name: form.name,
        category: CATEGORIES.find((c) => c.key === form.category)?.label ?? form.category,
        homeMaintenanceCategory: form.category,
        phone: form.phone,
        address: form.address || undefined,
      });
      setForm({ name: '', category: 'leakage', phone: '', address: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Home services"
      subtitle="Find help for leakage, cleaning, cooking, painting, gardening and more."
      action={canManage ? <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add a provider'}</Button> : undefined}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={activeCategory === c.key ? 'primary' : 'outline'}
              onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {!canManage && (
          <Link href={contactsHref}>
            <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
                  <UserPlus className="h-5 w-5 text-accent-600" />
                </span>
                <div className="flex-1">
                  <p className="font-bold text-text">Know a great local provider?</p>
                  <p className="text-sm text-text-secondary">Add them to your Contacts and share with the community</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
              </CardContent>
            </Card>
          </Link>
        )}

        {showForm && canManage && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-category">Category</Label>
                  <select
                    id="hs-category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as HomeCategory }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-name">Name</Label>
                  <Input id="hs-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ramesh — plumber" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-phone">Phone number</Label>
                  <Input id="hs-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-address">Address (optional)</Label>
                  <Input id="hs-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Shop 4, Main Road" />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.name || !form.phone} className="self-start">
                  {busy ? 'Adding…' : 'Add'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              No providers listed here yet.
            </CardContent>
          </Card>
        ) : (
          <>
            {verifiedListings.length > 0 && (
              <div>
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-text-secondary">
                  <BadgeCheck className="h-4 w-4 text-success-600" /> Registered by your community
                </h2>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {verifiedListings.map((v) => (
                    <VendorCard key={v.id} vendor={v} />
                  ))}
                </div>
              </div>
            )}

            {suggestedListings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-text-secondary">Suggested by residents</h2>
                <p className="text-xs text-text-secondary">Not yet verified by the committee — ask around before booking.</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {suggestedListings.map((v) => (
                    <VendorCard key={v.id} vendor={v} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CommunityPageFrame>
  );
}

function VendorCard({ vendor: v }: { vendor: Vendor }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <Wrench className="h-5 w-5 text-primary-600" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/community/vendors/${v.id}`} className="flex items-center gap-1.5 font-bold text-text hover:underline">
            <span className="truncate">{v.name}</span>
            {v.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-600" />}
          </Link>
          <div className="mt-0.5">
            <Badge variant="muted">{CATEGORIES.find((c) => c.key === v.homeMaintenanceCategory)?.label}</Badge>
          </div>
          {v.address && <p className="mt-1 truncate text-sm text-text-secondary">{v.address}</p>}
          <Link href={`/community/vendors/${v.id}`} className="mt-1 inline-block text-xs font-semibold text-primary-600 hover:underline">
            Raise a request or order
          </Link>
        </div>
        <a
          href={`tel:${v.phone}`}
          aria-label={`Call ${v.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
        >
          <Phone className="h-5 w-5" />
        </a>
      </CardContent>
    </Card>
  );
}
