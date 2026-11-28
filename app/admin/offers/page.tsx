'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, PlayCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FeatureSwitchCard } from '@/components/admin/feature-switch-card';
import { CAMPAIGN_STATUS_LABEL, PLACEMENTS, PLACEMENT_INFO, type CampaignStatus, type Placement } from '@/lib/campaigns';

interface AdminCampaign {
  id: string;
  placement: Placement;
  title: string;
  offerText: string;
  details: string | null;
  imagePaths: string[];
  videoUrl: string | null;
  contactPhone: string | null;
  days: number;
  price: number;
  status: CampaignStatus;
  paidAt: string | null;
  refundedAt: string | null;
  endsAt: string | null;
  adminNote: string | null;
  provider: { businessName: string; phone: string | null; verificationStatus: string };
  _count: { enquiries: number };
}
interface PageData {
  enabled: boolean;
  prices: Record<Placement, number>;
  campaigns: AdminCampaign[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  return json.data as T;
}
const asJson = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const STATUS_VARIANT: Record<CampaignStatus, 'accent' | 'success' | 'danger' | 'muted'> = {
  draft: 'muted',
  in_review: 'accent',
  live: 'success',
  rejected: 'danger',
  ended: 'muted',
  taken_down: 'danger',
};

/** EC approves paid offers and ads before anyone sees them, sets the prices, and can take one down. */
export default function AdminOffersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<PageData>('/admin/campaigns')
      .then((d) => {
        setData(d);
        setPrices(Object.fromEntries(PLACEMENTS.map((p) => [p, String(d.prices[p])])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);
  useEffect(load, [load]);

  async function savePrices() {
    setError('');
    setMsg('');
    try {
      const saved = await api<Record<Placement, number>>('/admin/campaigns', asJson('PATCH', Object.fromEntries(PLACEMENTS.map((p) => [p, Number(prices[p])]))));
      setData((d) => (d ? { ...d, prices: saved } : d));
      setMsg('Prices saved. Offers already made keep their price.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  if (!data) return <p className="text-text-secondary">{error || 'Loading…'}</p>;
  const waiting = data.campaigns.filter((c) => c.status === 'in_review');
  const shown = filter === 'waiting' ? waiting : data.campaigns;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <Megaphone className="h-6 w-6 text-primary-600" /> Offers &amp; ads
        </h1>
        <p className="mt-1 text-text-secondary">Providers pay first. Nothing shows until you approve it; rejecting refunds the payment in full.</p>
      </div>

      <FeatureSwitchCard
        featureKey="offers"
        title="Offers & ads"
        whenOn="Providers can make and pay for offers and ads. Elders and families get an Offers item in their menu, and approved ads show at the top of Offers and Services."
        initialOn={data.enabled}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="font-bold text-text">Prices for 30 days (7 and 15 days are worked out from these)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLACEMENTS.map((p) => (
              <div key={p} className="flex flex-col gap-2">
                <Label htmlFor={`price-${p}`}>{PLACEMENT_INFO[p].label}, ₹</Label>
                <Input id={`price-${p}`} type="number" min={1} value={prices[p] ?? ''} onChange={(e) => setPrices({ ...prices, [p]: e.target.value })} />
              </div>
            ))}
          </div>
          <Button variant="outline" className="self-start" onClick={savePrices}>
            Save prices
          </Button>
          {msg && <p className="text-sm text-success-600">{msg}</p>}
          {error && <p className="text-sm text-danger-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'waiting' ? 'primary' : 'outline'} onClick={() => setFilter('waiting')}>
          Waiting for approval ({waiting.length})
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
          All paid ({data.campaigns.length})
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-text-secondary">{filter === 'waiting' ? 'Nothing is waiting.' : 'No paid offers yet.'}</p>
      ) : (
        shown.map((c) => (
          <ReviewCard key={c.id} c={c} onChange={(u) => setData((d) => (d ? { ...d, campaigns: d.campaigns.map((x) => (x.id === u.id ? u : x)) } : d))} />
        ))
      )}
    </div>
  );
}

function ReviewCard({ c, onChange }: { c: AdminCampaign; onChange: (c: AdminCampaign) => void }) {
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(action: 'approve' | 'reject' | 'take_down') {
    const question =
      action === 'approve'
        ? `Approve "${c.title}"? It shows from now for ${c.days} days.`
        : action === 'reject'
          ? `Reject "${c.title}" and refund ₹${c.price.toLocaleString('en-IN')}? This cannot be undone.`
          : `Take down "${c.title}" now${refund ? ` and refund ₹${c.price.toLocaleString('en-IN')}` : ' (no refund)'}?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api<AdminCampaign>(`/admin/campaigns/${c.id}`, asJson('PATCH', { action, note: note.trim() || undefined, refund })));
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-text-secondary">
              {PLACEMENT_INFO[c.placement]?.label} · {c.days} days · paid ₹{c.price.toLocaleString('en-IN')}
              {c.paidAt ? ` on ${new Date(c.paidAt).toLocaleDateString('en-IN')}` : ''}
            </p>
            <p className="text-lg font-bold text-text">{c.title}</p>
            <p className="font-semibold text-accent-600">{c.offerText}</p>
            <p className="text-sm text-text-secondary">
              {c.provider.businessName} · {c.provider.phone || 'no phone'} · account {c.provider.verificationStatus} · calls go to {c.contactPhone || '-'}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
        </div>
        {c.details && <p className="whitespace-pre-line text-text">{c.details}</p>}
        {c.imagePaths.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.imagePaths.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-28 w-28 rounded-xl object-cover" />
              </a>
            ))}
          </div>
        )}
        {c.videoUrl && (
          <a href={c.videoUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 font-semibold text-primary-600 hover:underline">
            <PlayCircle className="h-5 w-5" /> Watch their video before approving
          </a>
        )}
        {c.status === 'live' && c.endsAt && <p className="text-sm text-success-600">Showing until {new Date(c.endsAt).toLocaleDateString('en-IN')} · {c._count.enquiries} questions so far</p>}
        {c.refundedAt && <p className="text-sm text-text-secondary">Refunded on {new Date(c.refundedAt).toLocaleDateString('en-IN')}</p>}
        {c.adminNote && <p className="text-sm text-text-secondary">Note: {c.adminNote}</p>}

        {(c.status === 'in_review' || c.status === 'live') && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`note-${c.id}`}>Reason for the provider (needed to reject or take down)</Label>
              <Input id={`note-${c.id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The offer makes a medical claim we cannot allow." />
            </div>
            {c.status === 'live' && (
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" className="h-5 w-5" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Also refund the full payment
              </label>
            )}
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {c.status === 'in_review' && (
                <>
                  <Button onClick={() => decide('approve')} disabled={busy}>
                    Approve
                  </Button>
                  <Button variant="outline" className="text-danger-600" onClick={() => decide('reject')} disabled={busy}>
                    Reject and refund
                  </Button>
                </>
              )}
              {c.status === 'live' && (
                <Button variant="outline" className="text-danger-600" onClick={() => decide('take_down')} disabled={busy}>
                  Take down
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
