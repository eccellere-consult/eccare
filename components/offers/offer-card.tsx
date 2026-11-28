'use client';

import { useEffect, useState } from 'react';
import { Phone, MessageCircle, PlayCircle, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface PublicOffer {
  id: string;
  placement: string;
  title: string;
  offerText: string;
  details: string | null;
  imagePaths: string[];
  videoUrl: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  endsAt: string | null;
  provider: { businessName: string; serviceArea: string | null };
}

function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * One offer, calm and readable: a still photo (nothing moves or plays by itself), the offer in
 * big type, and three ways to reach the provider: Call, WhatsApp, or a written question.
 */
export function OfferCard({ offer, sponsored = false }: { offer: PublicOffer; sponsored?: boolean }) {
  const [photo, setPhoto] = useState(0);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const [sharePhone, setSharePhone] = useState(true);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const wa = offer.whatsappPhone || offer.contactPhone;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`/api/v1/offers/${offer.id}/enquiry`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sharePhone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not send. Please try again.');
      setSent(true);
      setAsking(false);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    }
  }

  return (
    <Card className={sponsored ? 'border-accent-100' : undefined}>
      <CardContent className="flex flex-col gap-3 pt-6">
        {sponsored && (
          <Badge variant="muted" className="self-start">
            Sponsored
          </Badge>
        )}
        {offer.imagePaths.length > 0 && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={offer.imagePaths[photo]} alt={offer.title} className="aspect-[4/3] w-full rounded-xl bg-primary-50 object-cover" loading="lazy" />
            {offer.imagePaths.length > 1 && (
              <div className="mt-2 flex gap-2">
                {offer.imagePaths.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setPhoto(i)}
                    aria-label={`Photo ${i + 1}`}
                    className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${i === photo ? 'border-primary-600' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {offer.provider.businessName}
            {offer.provider.serviceArea ? ` · ${offer.provider.serviceArea}` : ''}
          </p>
          <p className="text-lg font-bold text-text">{offer.title}</p>
          <p className="mt-1 text-xl font-bold text-accent-600">{offer.offerText}</p>
          {offer.details && <p className="mt-2 whitespace-pre-line text-text">{offer.details}</p>}
          {offer.endsAt && <p className="mt-2 text-sm text-text-secondary">Offer until {new Date(offer.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
        </div>
        {offer.videoUrl && (
          <a href={offer.videoUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 font-semibold text-primary-600 hover:underline">
            <PlayCircle className="h-5 w-5" /> Watch the video
          </a>
        )}

        <div className="flex flex-wrap gap-2">
          {offer.contactPhone && (
            <Button asChild className="flex-1">
              <a href={`tel:${offer.contactPhone}`}>
                <Phone className="h-4 w-4" /> Call
              </a>
            </Button>
          )}
          {wa && (
            <Button asChild variant="outline" className="flex-1">
              <a href={`https://wa.me/${waNumber(wa)}?text=${encodeURIComponent(`Hello, I saw your offer "${offer.title}" on EC.`)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => setAsking((a) => !a)}>
            <Send className="h-4 w-4" /> Ask a question
          </Button>
        </div>
        {sent && <p className="text-sm text-success-600">Sent. {offer.provider.businessName} will get back to you.</p>}
        {asking && (
          <form onSubmit={ask} className="flex flex-col gap-2">
            <label htmlFor={`ask-${offer.id}`} className="font-semibold text-text">
              Your question
            </label>
            <textarea
              id={`ask-${offer.id}`}
              rows={3}
              maxLength={1000}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              placeholder="e.g. Can you come this Saturday morning?"
            />
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" className="h-5 w-5" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} />
              Share my phone number so they can call me back
            </label>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" className="self-start">
              Send
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** The one quiet "Sponsored" card for a slot; renders nothing when there is no ad. */
export function SponsoredSlot({ slot }: { slot: 'services_top' }) {
  const [ad, setAd] = useState<PublicOffer | null>(null);
  useEffect(() => {
    fetch(`/api/v1/offers?ad=${slot}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setAd(j?.success ? j.data.ad : null))
      .catch(() => setAd(null));
  }, [slot]);
  if (!ad) return null;
  return (
    <div className="mt-6">
      <OfferCard offer={ad} sponsored />
    </div>
  );
}
