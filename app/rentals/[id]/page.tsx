'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Phone, MessageCircle, Upload, Accessibility } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { buildWaLink as waLink } from '@/lib/whatsapp';

interface Listing {
  id: string;
  title: string;
  listingType: 'entire_house' | 'room';
  monthlyRent: string;
  securityDeposit: string | null;
  address: string | null;
  city: string | null;
  description: string | null;
  houseRules: string | null;
  imagePath: string | null;
  contactPhone: string;
  wheelchairRamp: boolean;
  grabBars: boolean;
  noStepEntry: boolean;
  groundFloor: boolean;
  status: 'active' | 'in_negotiation' | 'rented';
  postedBy: { id: string; name: string };
}
interface Inquiry {
  id: string;
  message: string | null;
  visitDate: string | null;
  status: 'open' | 'scheduled' | 'closed';
  createdAt: string;
  inquirer: { id: string; name: string; phone: string | null };
}
interface Me {
  id: string;
}

const ACCESSIBILITY_TAGS = [
  { key: 'wheelchairRamp', label: 'Wheelchair ramp' },
  { key: 'grabBars', label: 'Grab bars' },
  { key: 'noStepEntry', label: 'No-step entry' },
  { key: 'groundFloor', label: 'Ground floor' },
] as const;
const STATUS_OPTIONS = ['active', 'in_negotiation', 'rented'] as const;
const INQUIRY_STATUS_OPTIONS = ['open', 'scheduled', 'closed'] as const;

export default function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listing, setListing] = useState<Listing | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [message, setMessage] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [sending, setSending] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/rentals/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([listingJson, meJson]) => {
        if (!listingJson.success) throw new Error(listingJson.error?.message);
        setListing(listingJson.data);
        if (meJson.success) setMe(meJson.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this listing.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = listing && me && listing.postedBy.id === me.id;

  useEffect(() => {
    if (isOwner) {
      fetch(`/api/v1/rentals/${id}/inquiries`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (j.success) setInquiries(j.data); });
    }
  }, [isOwner, id]);

  async function sendInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/rentals/${id}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: message.trim() || undefined,
          visitDate: visitDate ? new Date(visitDate).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not send inquiry.');
      setInquirySent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send inquiry.');
    } finally {
      setSending(false);
    }
  }

  async function updateListingStatus(status: Listing['status']) {
    await fetch(`/api/v1/rentals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function updateInquiryStatus(inquiryId: string, status: Inquiry['status']) {
    await fetch(`/api/v1/rentals/inquiries/${inquiryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    setInquiries((prev) => prev?.map((i) => (i.id === inquiryId ? { ...i, status } : i)) ?? null);
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/v1/rentals/${id}/image`, { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Upload failed.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error && !listing) return <p className="text-danger-600">{error}</p>;
  if (!listing) return null;

  return (
    <div>
      <Link href="/rentals" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Rentals
      </Link>

      <div className="mt-3 flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-primary-50">
        {listing.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imagePath} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <Home className="h-16 w-16 text-primary-600" />
        )}
      </div>

      {isOwner && (
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline">
          <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : listing.imagePath ? 'Replace photo' : 'Add a photo'}
          <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploading} onChange={uploadPhoto} />
        </label>
      )}

      <h1 className="mt-4 text-2xl font-bold text-text">{listing.title}</h1>
      <p className="mt-1 text-lg font-semibold text-primary-900">
        ₹{listing.monthlyRent}/month
        {listing.securityDeposit && <span className="text-sm font-normal text-text-secondary"> · ₹{listing.securityDeposit} deposit</span>}
      </p>
      {(listing.address || listing.city) && (
        <p className="mt-1 text-sm text-text-secondary">{[listing.address, listing.city].filter(Boolean).join(', ')}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {ACCESSIBILITY_TAGS.filter((t) => listing[t.key]).map((t) => (
          <Badge key={t.key} variant="success"><Accessibility className="mr-1 h-3 w-3" />{t.label}</Badge>
        ))}
      </div>

      {listing.description && <p className="mt-4 leading-relaxed text-text-secondary">{listing.description}</p>}
      {listing.houseRules && (
        <div className="mt-4">
          <p className="text-sm font-bold text-text">House rules</p>
          <p className="mt-1 text-sm text-text-secondary">{listing.houseRules}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <a href={`tel:${listing.contactPhone}`} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text hover:bg-primary-50">
          <Phone className="h-4 w-4" /> Call
        </a>
        <a href={waLink(listing.contactPhone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text hover:bg-primary-50">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </div>

      {isOwner ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm font-bold text-text">Listing status</p>
            <div className="mt-2 flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateListingStatus(s)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize ${listing.status === s ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            <p className="mt-6 text-sm font-bold text-text">Inquiries ({inquiries?.length ?? 0})</p>
            {inquiries && inquiries.length === 0 && <p className="mt-1 text-sm text-text-secondary">No inquiries yet.</p>}
            <div className="mt-2 flex flex-col gap-2">
              {inquiries?.map((inq) => (
                <div key={inq.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-text">{inq.inquirer.name}</p>
                    <Badge variant={inq.status === 'closed' ? 'muted' : inq.status === 'scheduled' ? 'success' : 'accent'}>{inq.status}</Badge>
                  </div>
                  {inq.message && <p className="mt-1 text-sm text-text-secondary">{inq.message}</p>}
                  {inq.visitDate && <p className="mt-1 text-xs text-text-secondary">Requested visit: {new Date(inq.visitDate).toLocaleString('en-IN')}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {inq.inquirer.phone && (
                      <a href={`tel:${inq.inquirer.phone}`} className="text-xs font-semibold text-primary-600 hover:underline">Call</a>
                    )}
                    {INQUIRY_STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateInquiryStatus(inq.id, s)}
                        className={`rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize ${inq.status === s ? 'border-primary-600 text-primary-900' : 'border-border text-text-secondary'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="pt-6">
            {inquirySent ? (
              <p className="text-sm text-success-600">Inquiry sent — the lister can now see your message and reach you directly.</p>
            ) : (
              <form onSubmit={sendInquiry} className="flex flex-col gap-3">
                <p className="text-sm font-bold text-text">Send an inquiry</p>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="inq-message">Message (optional)</Label>
                  <Input id="inq-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="I'm interested — is it still available?" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="inq-visit">Requested visit date/time (optional)</Label>
                  <Input id="inq-visit" type="datetime-local" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </div>
                {error && <p className="text-sm text-danger-600">{error}</p>}
                <Button type="submit" disabled={sending} className="w-fit">
                  {sending ? 'Sending…' : 'Send inquiry'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
