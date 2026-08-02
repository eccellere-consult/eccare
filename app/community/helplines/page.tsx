'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Helpline {
  id: string;
  label: string;
  phone: string;
  category: string;
}
interface Me { memberships: { role: string }[] }

export default function HelplinesPage() {
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data, loading, error, reload } = useCommunityData<Helpline[]>('/community/helplines');
  const canPost = me?.memberships?.[0]?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/helplines', { label, phone, category: category || undefined });
      setLabel('');
      setPhone('');
      setCategory('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add helpline.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Helpline numbers"
      subtitle="Tap any number to call straight away."
      action={
        canPost ? (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add helpline'}</Button>
        ) : undefined
      }
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="Your committee hasn't added helpline numbers yet."
    >
      <div className="flex flex-col gap-3">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-label">Name</Label>
                  <Input id="helpline-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Security desk" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-phone">Phone number</Label>
                  <Input id="helpline-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-category">Category (optional)</Label>
                  <Input id="helpline-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Security, medical, fire…" />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !label.trim() || !phone.trim()}>
                  {busy ? 'Adding…' : 'Add helpline'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((h) => (
          // A plain tel: link rather than a JS handler — it works on every device and
          // needs no permission, which matters most for the emergency case.
          <a key={h.id} href={`tel:${h.phone}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-50">
                  <Phone className="h-5 w-5 text-danger-600" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold text-text">{h.label}</span>
                  <span className="block text-text-secondary">{h.phone}</span>
                </span>
                <span className="rounded-xl bg-danger-600 px-4 py-2 font-semibold text-white">Call</span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
