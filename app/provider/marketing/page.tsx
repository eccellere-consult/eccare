'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Megaphone, Trash2, Inbox, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { shrinkPhoto } from '@/lib/shrink-photo';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import {
  CAMPAIGN_STATUS_LABEL,
  DURATIONS,
  MAX_IMAGES,
  PLACEMENTS,
  PLACEMENT_INFO,
  missingBeforePay,
  priceFor,
  type CampaignStatus,
  type Placement,
} from '@/lib/campaigns';

interface Enquiry {
  id: string;
  name: string;
  phone: string | null;
  message: string;
  createdAt: string;
}
interface Campaign {
  id: string;
  placement: Placement;
  title: string;
  offerText: string;
  details: string | null;
  imagePaths: string[];
  videoUrl: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  days: number;
  price: number;
  status: CampaignStatus;
  adminNote: string | null;
  startsAt: string | null;
  endsAt: string | null;
  enquiries: Enquiry[];
}
interface PageData {
  enabled: boolean;
  prices: Record<Placement, number>;
  provider: { businessName: string; phone: string | null; verificationStatus: string };
  campaigns: Campaign[];
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
const fieldClass =
  'flex w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

/**
 * A provider's offers and paid ad space. Make an offer (photos, optional video link), pay, and
 * EC approves it before elders and families see it. Questions from customers arrive here.
 */
export default function ProviderMarketingPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ placement: 'offer' as Placement, days: 30 as number, title: '', offerText: '', details: '', videoUrl: '', contactPhone: '', whatsappPhone: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<PageData>('/provider/campaigns')
      .then((d) => {
        setData(d);
        setForm((f) => ({ ...f, contactPhone: f.contactPhone || d.provider.phone || '' }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);
  useEffect(load, [load]);

  const replace = (c: Campaign) => setData((d) => (d ? { ...d, campaigns: d.campaigns.map((x) => (x.id === c.id ? c : x)) } : d));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const c = await api<Campaign>(
        '/provider/campaigns',
        asJson('POST', {
          placement: form.placement,
          days: form.days,
          title: form.title,
          offerText: form.offerText,
          details: form.details.trim() || null,
          videoUrl: form.videoUrl.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          whatsappPhone: form.whatsappPhone.trim() || null,
        }),
      );
      setData((d) => (d ? { ...d, campaigns: [c, ...d.campaigns] } : d));
      setForm((f) => ({ ...f, title: '', offerText: '', details: '', videoUrl: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setCreating(false);
    }
  }

  if (!data) return <p className="text-text-secondary">{error || 'Loading…'}</p>;
  const price = priceFor(data.prices[form.placement], form.days);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <Megaphone className="h-6 w-6 text-primary-600" /> Offers &amp; ads
        </h1>
        <p className="mt-1 text-text-secondary">
          Tell elders and families about an offer. You pay first; EC checks it and it shows from the day it is approved. If EC
          does not approve it, you get your money back in full.
        </p>
      </div>

      {!data.enabled && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="pt-6 text-sm text-text">This opens on EC&rsquo;s launch day.</CardContent>
        </Card>
      )}
      {data.provider.verificationStatus !== 'verified' && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="pt-6 text-sm text-text">EC is still checking your provider account. You can prepare an offer now and pay once you are approved.</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={create} className="flex flex-col gap-4">
            <p className="font-bold text-text">New offer or ad</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLACEMENTS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setForm({ ...form, placement: p })}
                  className={`rounded-xl border p-3 text-left ${form.placement === p ? 'border-primary-600 bg-primary-50' : 'border-border bg-surface hover:bg-primary-50'}`}
                >
                  <span className="block font-semibold text-text">{PLACEMENT_INFO[p].label}</span>
                  <span className="block text-xs text-text-secondary">{PLACEMENT_INFO[p].hint}</span>
                  <span className="mt-1 block text-sm font-bold text-text">₹{data.prices[p].toLocaleString('en-IN')} / 30 days</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-title">Title</Label>
                <Input id="c-title" required minLength={3} maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Home physiotherapy, first visit offer" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-offer">The offer, in one line</Label>
                <Input id="c-offer" required minLength={3} maxLength={120} value={form.offerText} onChange={(e) => setForm({ ...form, offerText: e.target.value })} placeholder="e.g. 20% off the first 3 visits" />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="c-details">Details (optional)</Label>
                <textarea id="c-details" rows={3} maxLength={1500} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className={fieldClass} placeholder="What is included, timings, area you serve, conditions" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-video">Video link (optional)</Label>
                <Input id="c-video" maxLength={300} value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtu.be/... or an Instagram reel" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-days">How long</Label>
                <select id="c-days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className={`${fieldClass} h-11`}>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-phone">Phone customers call</Label>
                <Input id="c-phone" inputMode="tel" required maxLength={20} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-wa">WhatsApp number (if different)</Label>
                <Input id="c-wa" inputMode="tel" maxLength={20} value={form.whatsappPhone} onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })} />
              </div>
            </div>
            <p className="text-text">
              Price: <span className="font-bold">₹{price.toLocaleString('en-IN')}</span> for {form.days} days. You add photos next, then pay.
            </p>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" className="self-start" disabled={creating || !data.enabled}>
              {creating ? 'Saving…' : 'Save and add photos'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {data.campaigns.map((c) => (
        <CampaignCard
          key={c.id}
          campaign={c}
          onChange={replace}
          onRemoved={() => setData((d) => (d ? { ...d, campaigns: d.campaigns.filter((x) => x.id !== c.id) } : d))}
        />
      ))}
    </div>
  );
}

function CampaignCard({ campaign: c, onChange, onRemoved }: { campaign: Campaign; onChange: (c: Campaign) => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const missing = missingBeforePay(c);

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', await shrinkPhoto(picked));
      onChange(await api<Campaign>(`/provider/campaigns/${c.id}/images`, { method: 'POST', body }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(i: number) {
    try {
      onChange(await api<Campaign>(`/provider/campaigns/${c.id}/images?index=${i}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove.');
    }
  }

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const order = await api<{ keyId: string; amount: number; razorpayOrderId: string }>(`/provider/campaigns/${c.id}/pay`, { method: 'POST' });
      const result = await openRazorpayCheckout(order, `${PLACEMENT_INFO[c.placement].label} (${c.days} days)`);
      if (result) onChange(await api<Campaign>(`/provider/campaigns/${c.id}/pay`, asJson('PUT', result)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove this unpaid draft?')) return;
    try {
      await api(`/provider/campaigns/${c.id}`, { method: 'DELETE' });
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove.');
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-text-secondary">{PLACEMENT_INFO[c.placement]?.label}</p>
            <p className="text-lg font-bold text-text">{c.title}</p>
            <p className="font-semibold text-accent-600">{c.offerText}</p>
          </div>
          <Badge variant={STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
        </div>
        {c.status === 'live' && c.endsAt && <p className="text-sm text-success-600">Showing until {new Date(c.endsAt).toLocaleDateString('en-IN')}</p>}
        {c.adminNote && (
          <p className="rounded-xl bg-accent-50 p-3 text-sm text-text">
            <span className="font-semibold">Note from EC:</span> {c.adminNote}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {c.imagePaths.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
              {c.status === 'draft' && (
                <button type="button" aria-label="Remove photo" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-surface p-1 shadow">
                  <Trash2 className="h-4 w-4 text-danger-600" />
                </button>
              )}
            </div>
          ))}
          {c.status === 'draft' && c.imagePaths.length < MAX_IMAGES && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border text-xs text-primary-600 hover:bg-primary-50">
              <ImagePlus className="h-6 w-6" /> Add photo
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={addPhoto} />
            </label>
          )}
        </div>

        {c.status === 'draft' && (
          <>
            {missing.length > 0 && <p className="text-sm text-text-secondary">Before paying, add: {missing.join(', ')}.</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={pay} disabled={busy || missing.length > 0}>
                {busy ? 'Please wait…' : `Pay ₹${c.price.toLocaleString('en-IN')} and send to EC`}
              </Button>
              <Button variant="ghost" className="text-danger-600" onClick={remove} disabled={busy}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-danger-600">{error}</p>}

        {c.enquiries.length > 0 && (
          <div>
            <p className="flex items-center gap-2 font-semibold text-text">
              <Inbox className="h-4 w-4" /> Questions from customers ({c.enquiries.length})
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {c.enquiries.map((q) => (
                <li key={q.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-semibold text-text">
                    {q.name} · {new Date(q.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  <p className="whitespace-pre-line text-text">{q.message}</p>
                  {q.phone ? (
                    <a href={`tel:${q.phone}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-primary-600">
                      <Phone className="h-4 w-4" /> {q.phone}
                    </a>
                  ) : (
                    <p className="mt-1 text-text-secondary">They did not share a phone number.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
