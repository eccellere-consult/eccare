'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Neighborhood {
  id: string;
  name: string;
  city: string | null;
  pincode: string | null;
  joinCode: string;
  createdAt: string;
  _count: { members: number };
}

export default function AdminCommunitiesPage() {
  const { data, loading, error, reload } = useCommunityData<Neighborhood[]>(
    '/community/neighborhoods',
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', pincode: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/neighborhoods', {
        name: form.name,
        city: form.city || undefined,
        pincode: form.pincode || undefined,
      });
      setForm({ name: '', city: '', pincode: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create community.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Communities</h1>
          <p className="mt-1 text-text-secondary">
            Share a community&rsquo;s join code with its residents so they can join themselves.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Create community'}
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                {([
                  ['name', 'Community name', 'Green Meadows Society'],
                  ['city', 'City (optional)', 'Bengaluru'],
                  ['pincode', 'Pincode (optional)', '560001'],
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
                <Button type="submit" disabled={busy || !form.name.trim()}>
                  {busy ? 'Creating…' : 'Create community'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
          </Card>
        ) : (data?.length ?? 0) === 0 && !showForm ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              No communities yet. Create the first one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((n) => (
              <Link key={n.id} href={`/admin/communities/${n.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-text">{n.name}</p>
                        <p className="text-sm text-text-secondary">
                          {[n.city, n.pincode].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <Badge variant="muted">
                        {n._count.members} member{n._count.members === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">
                      Join code:{' '}
                      <span className="rounded bg-primary-50 px-2 py-1 font-mono font-bold tracking-widest text-primary-900">
                        {n.joinCode}
                      </span>
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
