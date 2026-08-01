'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QueryThread } from '@/components/query-thread';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface NeighborhoodDetail {
  id: string;
  name: string;
  city: string | null;
  pincode: string | null;
  description: string | null;
  joinCode: string;
  _count: {
    members: number;
    events: number;
    helplines: number;
    listings: number;
    queries: number;
    notices: number;
    whatsAppGroups: number;
  };
}

const TABS = ['Overview', 'Notices', 'Helplines', 'Vendors', 'Events', 'Queries'] as const;
type Tab = (typeof TABS)[number];

export default function AdminCommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useCommunityData<NeighborhoodDetail>(
    `/community/neighborhoods/${id}`,
  );
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div>
      <Link
        href="/admin/communities"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Communities
      </Link>

      {loading ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : error || !data ? (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-danger-600">{error ?? 'Not found.'}</CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text">{data.name}</h1>
              <p className="mt-1 text-text-secondary">
                {[data.city, data.pincode].filter(Boolean).join(' · ') || '—'} · Join code{' '}
                <span className="font-mono font-bold tracking-widest">{data.joinCode}</span>
              </p>
            </div>
            <Badge variant="muted">{data._count.members} members</Badge>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-primary-50 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  tab === t ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === 'Overview' && <OverviewTab neighborhood={data} onSaved={reload} />}
            {tab === 'Notices' && <NoticesTab neighborhoodId={id} />}
            {tab === 'Helplines' && <HelplinesTab neighborhoodId={id} />}
            {tab === 'Vendors' && <VendorsTab neighborhoodId={id} />}
            {tab === 'Events' && <EventsTab neighborhoodId={id} />}
            {tab === 'Queries' && <QueriesTab neighborhoodId={id} />}
          </div>
        </>
      )}
    </div>
  );
}

function OverviewTab({ neighborhood, onSaved }: { neighborhood: NeighborhoodDetail; onSaved: () => void }) {
  const [name, setName] = useState(neighborhood.name);
  const [city, setCity] = useState(neighborhood.city ?? '');
  const [pincode, setPincode] = useState(neighborhood.pincode ?? '');
  const [description, setDescription] = useState(neighborhood.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await communityApi.patch(`/community/neighborhoods/${neighborhood.id}`, {
        name,
        city: city || undefined,
        pincode: pincode || undefined,
        description: description || undefined,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const counts = [
    ['Notices', neighborhood._count.notices],
    ['Helplines', neighborhood._count.helplines],
    ['Vendors', neighborhood._count.listings],
    ['Events', neighborhood._count.events],
    ['Queries', neighborhood._count.queries],
    ['WhatsApp groups', neighborhood._count.whatsAppGroups],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {counts.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-black text-text">{value}</p>
              <p className="mt-1 text-sm text-text-secondary">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Community name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-xl border border-border bg-surface p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            {saved && !error && <p className="text-sm text-success-600">Saved.</p>}
            <Button type="submit" disabled={busy || !name.trim()} className="self-start">
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function NoticesTab({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error, reload } = useCommunityData<
    { id: string; title: string; body: string; pinned: boolean; createdAt: string; createdBy: { name: string } }[]
  >(`/community/notices?neighborhoodId=${neighborhoodId}`);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/notices', { title, body, neighborhoodId });
      setTitle('');
      setBody('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="notice-title">Title</Label>
              <Input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notice-body">Message</Label>
              <textarea
                id="notice-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="rounded-xl border border-border bg-surface p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              />
            </div>
            {formError && <p className="text-sm text-danger-600">{formError}</p>}
            <Button type="submit" disabled={busy || !title.trim() || !body.trim()} className="self-start">
              {busy ? 'Posting…' : 'Post announcement'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-danger-600">{error}</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-text-secondary">No announcements yet.</p>
      ) : (
        data?.map((n) => (
          <Card key={n.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-text">{n.title}</h3>
                {n.pinned && <Badge variant="accent">Pinned</Badge>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-text">{n.body}</p>
              <p className="mt-3 text-sm text-text-secondary">
                {n.createdBy.name} · {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function HelplinesTab({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error, reload } = useCommunityData<
    { id: string; label: string; phone: string; category: string }[]
  >(`/community/helplines?neighborhoodId=${neighborhoodId}`);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/helplines', { label, phone, category: category || undefined, neighborhoodId });
      setLabel('');
      setPhone('');
      setCategory('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add helpline.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="h-label">Name</Label>
              <Input id="h-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="h-phone">Phone</Label>
              <Input id="h-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="h-category">Category</Label>
              <Input id="h-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            {formError && <p className="sm:col-span-3 text-sm text-danger-600">{formError}</p>}
            <Button type="submit" disabled={busy || !label.trim() || !phone.trim()} className="self-start">
              {busy ? 'Adding…' : 'Add helpline'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-danger-600">{error}</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-text-secondary">No helplines yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold text-text">{h.label}</p>
                  <p className="text-sm text-text-secondary">{h.phone}</p>
                </div>
                <Badge variant="muted">{h.category}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorsTab({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error } = useCommunityData<
    { id: string; name: string; category: string; phone: string; verified: boolean }[]
  >(`/community/vendors?neighborhoodId=${neighborhoodId}`);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Residents add vendors themselves; committee members vouch by verifying them.
      </p>
      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-danger-600">{error}</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-text-secondary">No vendors yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold text-text">{v.name}</p>
                  <p className="text-sm text-text-secondary">{v.category} · {v.phone}</p>
                </div>
                {v.verified && <Badge variant="success">Verified</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTab({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error } = useCommunityData<
    { id: string; title: string; startsAt: string; location: string | null; goingCount: number }[]
  >(`/community/events?neighborhoodId=${neighborhoodId}`);

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-danger-600">{error}</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-text-secondary">No events yet.</p>
      ) : (
        data?.map((ev) => (
          <Card key={ev.id}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-bold text-text">{ev.title}</p>
                <p className="text-sm text-text-secondary">
                  {new Date(ev.startsAt).toLocaleString()}
                  {ev.location ? ` · ${ev.location}` : ''}
                </p>
              </div>
              <Badge variant="muted">{ev.goingCount} going</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function QueriesTab({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, loading, error, reload } = useCommunityData<
    {
      id: string;
      type: 'committee' | 'helpdesk';
      subject: string;
      body: string;
      status: 'open' | 'in_progress' | 'resolved' | 'closed';
      createdAt: string;
      user: { id: string; name: string };
      _count: { replies: number };
    }[]
  >(`/community/queries?neighborhoodId=${neighborhoodId}`);

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-danger-600">{error}</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-text-secondary">No queries yet.</p>
      ) : (
        data?.map((q) => <QueryThread key={q.id} query={q} canManageStatus onUpdated={reload} />)
      )}
    </div>
  );
}
