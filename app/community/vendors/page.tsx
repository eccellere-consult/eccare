'use client';

import { useState } from 'react';
import { Phone, BadgeCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string | null;
  verified: boolean;
}
interface Me { memberships: { role: string }[] }

export default function VendorsPage() {
  const { data, loading, error, reload } = useCommunityData<Vendor[]>('/community/vendors');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function verify(id: string) {
    setActionId(id);
    try {
      await communityApi.patch(`/community/vendors/${id}`, { verified: true });
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this vendor listing?')) return;
    setActionId(id);
    try {
      await communityApi.delete(`/community/vendors/${id}`);
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/vendors', {
        ...form,
        address: form.address || undefined,
      });
      setForm({ name: '', category: '', phone: '', address: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add vendor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Vendors"
      subtitle="Trusted plumbers, electricians, shops and services — all in one place."
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add vendor'}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="No vendors listed yet."
    >
      <div className="flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                {([
                  ['name', 'Business or person', 'Ramesh Electricals'],
                  ['category', 'Category', 'Electrician'],
                  ['phone', 'Phone number', '9876543210'],
                  ['address', 'Address (optional)', 'Shop 4, Main Road'],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.name || !form.category || !form.phone}>
                  {busy ? 'Adding…' : 'Add vendor'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold text-text">
                    <span className="truncate">{v.name}</span>
                    {v.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-600" />}
                  </p>
                  {/* div, not p — Badge renders a div (invalid inside a paragraph). */}
                  <div className="mt-0.5">
                    <Badge variant="muted">{v.category}</Badge>
                  </div>
                  {v.address && <p className="mt-1 truncate text-sm text-text-secondary">{v.address}</p>}
                </div>
                <a
                  href={`tel:${v.phone}`}
                  aria-label={`Call ${v.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                >
                  <Phone className="h-5 w-5" />
                </a>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {!v.verified && (
                      <Button size="sm" variant="outline" disabled={actionId === v.id} onClick={() => verify(v.id)}>
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger-600"
                      disabled={actionId === v.id}
                      onClick={() => remove(v.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CommunityPageFrame>
  );
}
