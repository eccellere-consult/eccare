'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Home, Plus, MapPin, Accessibility, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Listing {
  id: string;
  title: string;
  listingType: 'entire_house' | 'room';
  monthlyRent: string;
  city: string | null;
  imagePath: string | null;
  wheelchairRamp: boolean;
  grabBars: boolean;
  noStepEntry: boolean;
  groundFloor: boolean;
  status: 'active' | 'in_negotiation' | 'rented';
  postedBy: { id: string; name: string };
}

const STATUS_VARIANT: Record<Listing['status'], 'success' | 'accent' | 'muted'> = {
  active: 'success',
  in_negotiation: 'accent',
  rented: 'muted',
};
const STATUS_LABEL: Record<Listing['status'], string> = {
  active: 'Active',
  in_negotiation: 'In Negotiation',
  rented: 'Rented',
};
const ACCESSIBILITY_TAGS = [
  { key: 'wheelchairRamp', label: 'Wheelchair ramp' },
  { key: 'grabBars', label: 'Grab bars' },
  { key: 'noStepEntry', label: 'No-step entry' },
  { key: 'groundFloor', label: 'Ground floor' },
] as const;

const EMPTY_FORM = {
  title: '', listingType: 'room' as 'entire_house' | 'room', monthlyRent: '', securityDeposit: '',
  address: '', city: '', description: '', houseRules: '', contactPhone: '',
  wheelchairRamp: false, grabBars: false, noStepEntry: false, groundFloor: false,
};

export default function RentalsPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [listingType, setListingType] = useState('');
  const [city, setCity] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [accessibilityFilters, setAccessibilityFilters] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (listingType) params.set('listingType', listingType);
    if (city.trim()) params.set('city', city.trim());
    if (maxRent) params.set('maxRent', maxRent);
    accessibilityFilters.forEach((key) => params.set(key, '1'));
    fetch(`/api/v1/rentals?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setListings(j.data); else throw new Error(j.error?.message); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load listings.'))
      .finally(() => setLoading(false));
  }, [listingType, city, maxRent, accessibilityFilters]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleAccessibility(key: string) {
    setAccessibilityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function createListing(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.monthlyRent || !form.contactPhone.trim()) {
      setFormError('Please fill in the title, monthly rent, and a contact phone number.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.title.trim(),
          listingType: form.listingType,
          monthlyRent: Number(form.monthlyRent),
          securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          description: form.description.trim() || undefined,
          houseRules: form.houseRules.trim() || undefined,
          contactPhone: form.contactPhone.trim(),
          wheelchairRamp: form.wheelchairRamp,
          grabBars: form.grabBars,
          noStepEntry: form.noStepEntry,
          groundFloor: form.groundFloor,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not create listing.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create listing.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Services
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Senior-Friendly Rentals</h1>
          <p className="mt-1 text-text-secondary">Independent houses and rooms, filtered for safe, accessible living.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'List a house or room'}
        </Button>
      </div>

      {showForm && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={createListing} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="r-title">Title</Label>
                <Input id="r-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ground-floor room near hospital, senior-friendly" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="r-type">Type</Label>
                <select
                  id="r-type"
                  value={form.listingType}
                  onChange={(e) => setForm((f) => ({ ...f, listingType: e.target.value as 'entire_house' | 'room' }))}
                  className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <option value="room">Individual room</option>
                  <option value="entire_house">Entire house</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="r-rent">Monthly rent (₹)</Label>
                <Input id="r-rent" type="number" min="0" value={form.monthlyRent} onChange={(e) => setForm((f) => ({ ...f, monthlyRent: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="r-deposit">Security deposit (₹, optional)</Label>
                <Input id="r-deposit" type="number" min="0" value={form.securityDeposit} onChange={(e) => setForm((f) => ({ ...f, securityDeposit: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="r-phone">Contact phone</Label>
                <Input id="r-phone" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="9876543210" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="r-city">City</Label>
                <Input id="r-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="r-address">Address (optional)</Label>
                <Input id="r-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="r-desc">Description (optional)</Label>
                <Input id="r-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="r-rules">House rules (optional)</Label>
                <Input id="r-rules" value={form.houseRules} onChange={(e) => setForm((f) => ({ ...f, houseRules: e.target.value }))} placeholder="No smoking, quiet hours after 9pm…" />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Accessibility</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCESSIBILITY_TAGS.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, [tag.key]: !f[tag.key as keyof typeof f] }))}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${form[tag.key as keyof typeof form] ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p className="text-sm text-danger-600 sm:col-span-2">{formError}</p>}
              <Button type="submit" disabled={saving} className="w-fit sm:col-span-2">
                {saving ? 'Publishing…' : 'Publish listing'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {[{ v: '', l: 'All' }, { v: 'room', l: 'Room' }, { v: 'entire_house', l: 'House' }].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setListingType(opt.v)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${listingType === opt.v ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-32" />
        <Input type="number" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} placeholder="Max rent ₹" className="w-32" />
        <div className="flex flex-wrap gap-2">
          {ACCESSIBILITY_TAGS.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() => toggleAccessibility(tag.key)}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${accessibilityFilters.has(tag.key) ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
            >
              <Accessibility className="h-3 w-3" /> {tag.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listings?.map((l) => (
          <Link key={l.id} href={`/rentals/${l.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-t-2xl bg-primary-50">
                {l.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imagePath} alt={l.title} className="h-full w-full object-cover" />
                ) : (
                  <Home className="h-10 w-10 text-primary-600" />
                )}
              </div>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-text">{l.title}</p>
                  <Badge variant={STATUS_VARIANT[l.status]} className="shrink-0">{STATUS_LABEL[l.status]}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-primary-900">₹{l.monthlyRent}/month</p>
                {l.city && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                    <MapPin className="h-3 w-3" /> {l.city}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {ACCESSIBILITY_TAGS.filter((t) => l[t.key]).map((t) => (
                    <Badge key={t.key} variant="muted" className="text-[10px]">{t.label}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && (!listings || listings.length === 0) && (
        <Card className="mt-4"><CardContent className="py-12 text-center text-text-secondary">No listings match right now.</CardContent></Card>
      )}
    </div>
  );
}
