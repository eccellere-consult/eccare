'use client';

import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  const [category, setCategory] = useState(initial.category);
  const [description, setDescription] = useState(initial.description ?? '');
  const [serviceArea, setServiceArea] = useState(initial.serviceArea ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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
          category,
          description: description || undefined,
          serviceArea: serviceArea || undefined,
          phone: phone || undefined,
          address: address || undefined,
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
                <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
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
    </div>
  );
}
