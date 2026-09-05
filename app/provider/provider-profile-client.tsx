'use client';

import { useState } from 'react';
import { FileText, Upload, Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PROVIDER_CATEGORIES } from '@/lib/provider-categories';

type ElderCareCategory = 'home_treatment' | 'home_nursing' | 'companion_service' | 'local_errands' | 'other';
const ELDER_CARE_CATEGORIES: { key: ElderCareCategory; label: string }[] = [
  { key: 'home_treatment', label: 'Home treatment' },
  { key: 'home_nursing', label: 'Home nursing' },
  { key: 'companion_service', label: 'Companion service' },
  { key: 'local_errands', label: 'Local errands' },
  { key: 'other', label: 'Other' },
];

interface ServiceProvider {
  businessName: string;
  category: string;
  description: string | null;
  serviceArea: string | null;
  phone: string | null;
  address: string | null;
  certificationFileName: string | null;
  certificationFilePath: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  elderCareCategory: ElderCareCategory | null;
  isFeatured: boolean;
  featuredUntil: string | null;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const STATUS_VARIANT = { pending: 'accent', verified: 'success', rejected: 'danger' } as const;
const STATUS_LABEL = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
} as const;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

export function ProviderProfileClient({ initial }: { initial: ServiceProvider }) {
  const [provider, setProvider] = useState(initial);
  const [businessName, setBusinessName] = useState(initial.businessName);
  // A category saved before this dropdown existed (or "Others" with custom
  // text) won't match any known value — fall back to "other" with that text
  // pre-filled, rather than silently losing/hiding it.
  const isKnownCategory = PROVIDER_CATEGORIES.some((c) => c.value === initial.category);
  const [category, setCategory] = useState(isKnownCategory ? initial.category : 'other');
  const [otherCategory, setOtherCategory] = useState(isKnownCategory ? '' : initial.category);
  const [description, setDescription] = useState(initial.description ?? '');
  const [serviceArea, setServiceArea] = useState(initial.serviceArea ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [elderCareCategory, setElderCareCategory] = useState<ElderCareCategory | ''>(initial.elderCareCategory ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [adBusy, setAdBusy] = useState(false);
  const [adError, setAdError] = useState('');

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api('/provider/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          category: category === 'other' ? otherCategory.trim() : category,
          description: description || undefined,
          serviceArea: serviceArea || undefined,
          phone: phone || undefined,
          address: address || undefined,
          elderCareCategory: elderCareCategory || null,
        }),
      });
      setProvider(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function getFeatured() {
    setAdBusy(true);
    setAdError('');
    try {
      const order = await api('/provider/featured-ad', { method: 'POST' });
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: 'INR',
        order_id: order.razorpayOrderId,
        name: 'EC',
        description: 'Elder Care Services — featured listing (30 days)',
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const updated = await api('/provider/featured-ad/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            setProvider(updated);
          } catch (err) {
            setAdError(err instanceof Error ? err.message : 'Payment could not be verified. Please contact support.');
          } finally {
            setAdBusy(false);
          }
        },
        modal: { ondismiss: () => setAdBusy(false) },
        theme: { color: '#0B5563' },
      });
      razorpay.open();
    } catch (err) {
      setAdError(err instanceof Error ? err.message : 'Could not start payment. Please try again.');
      setAdBusy(false);
    }
  }

  async function uploadCertification(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const updated = await api('/provider/certification', { method: 'POST', body });
      setProvider(updated);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="font-bold text-text">Verification status</p>
            {provider.verificationStatus === 'rejected' && provider.rejectionReason && (
              <p className="mt-1 text-sm text-text-secondary">{provider.rejectionReason}</p>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[provider.verificationStatus]}>
            {STATUS_LABEL[provider.verificationStatus]}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-bold text-text">Business profile</h2>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  {PROVIDER_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {category === 'other' && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="category-other">Tell us your category</Label>
                  <Input id="category-other" value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} placeholder="e.g. Home care, catering, tutoring…" />
                </div>
              )}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="serviceArea">Service area</Label>
                <Input id="serviceArea" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Koramangala, Bengaluru" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="elderCareCategory">Elder Care Services category (optional)</Label>
              <select
                id="elderCareCategory"
                value={elderCareCategory}
                onChange={(e) => setElderCareCategory(e.target.value as ElderCareCategory | '')}
                className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <option value="">Not an elder-care provider</option>
                {ELDER_CARE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-text-secondary">
                Pick a category to appear in the Elder Care Services directory that families browse.
              </p>
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            {saved && !error && <p className="text-sm text-success-600">Saved.</p>}
            <Button type="submit" disabled={busy || !businessName.trim() || !category.trim()} className="self-start">
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-bold text-text">Certification / proof of license</h2>
          {provider.certificationFilePath ? (
            <a
              href={provider.certificationFilePath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm hover:bg-primary-50"
            >
              <FileText className="h-5 w-5 shrink-0 text-primary-600" />
              <span className="truncate">{provider.certificationFileName ?? 'View uploaded file'}</span>
            </a>
          ) : (
            <p className="text-sm text-text-secondary">No certification uploaded yet.</p>
          )}
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary-600">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : provider.certificationFilePath ? 'Replace file' : 'Upload certification'}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              disabled={uploading}
              onChange={uploadCertification}
            />
          </label>
          {uploadError && <p className="mt-2 text-sm text-danger-600">{uploadError}</p>}
        </CardContent>
      </Card>

      {provider.elderCareCategory && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex items-start gap-3">
              <Megaphone className="h-6 w-6 shrink-0 text-accent-600" />
              <div>
                <p className="font-bold text-text">Elder Care Services featured listing</p>
                {provider.isFeatured && provider.featuredUntil ? (
                  <p className="mt-1 text-sm text-text-secondary">
                    Featured until {new Date(provider.featuredUntil).toLocaleDateString()}.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-text-secondary">
                    Pay a flat fee to appear at the top of the Elder Care Services directory for 30 days.
                  </p>
                )}
                {adError && <p className="mt-1 text-sm text-danger-600">{adError}</p>}
              </div>
            </div>
            {provider.verificationStatus === 'verified' ? (
              <Button onClick={getFeatured} disabled={adBusy}>
                {adBusy ? 'Opening payment…' : provider.isFeatured ? 'Extend 30 days' : 'Get featured'}
              </Button>
            ) : (
              <p className="text-sm text-text-secondary">Verification required first.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
