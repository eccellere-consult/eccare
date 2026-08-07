'use client';

import { useState } from 'react';
import { Palette, Phone, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

type HobbyCategory = 'art' | 'music' | 'dance' | 'theatre' | 'books' | 'discussion' | 'teaching' | 'other';

interface Group {
  id: string;
  name: string;
  category: HobbyCategory;
  description: string | null;
  createdBy: { id: string; name: string };
  memberCount: number;
  isMember: boolean;
}
interface Member { id: string; name: string; phone: string | null; joinedAt: string }

const CATEGORIES: { key: HobbyCategory; label: string }[] = [
  { key: 'art', label: 'Art' },
  { key: 'music', label: 'Music' },
  { key: 'dance', label: 'Dance' },
  { key: 'theatre', label: 'Theatre' },
  { key: 'books', label: 'Books' },
  { key: 'discussion', label: 'Discussions' },
  { key: 'teaching', label: 'Teaching' },
  { key: 'other', label: 'Other' },
];

export default function HobbiesPage() {
  const { data, loading, error, reload } = useCommunityData<Group[]>('/community/hobby-groups');
  const [activeCategory, setActiveCategory] = useState<HobbyCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'art' as HobbyCategory, description: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const filtered = (data ?? []).filter((g) => !activeCategory || g.category === activeCategory);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/hobby-groups', {
        name: form.name,
        category: form.category,
        description: form.description || undefined,
      });
      setForm({ name: '', category: activeCategory ?? 'art', description: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMembership(group: Group) {
    setActionId(group.id);
    try {
      if (group.isMember) {
        await communityApi.delete(`/community/hobby-groups/${group.id}/membership`);
      } else {
        await communityApi.post(`/community/hobby-groups/${group.id}/membership`, {});
      }
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function toggleExpand(group: Group) {
    if (expandedId === group.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(group.id);
    setMembersLoading(true);
    try {
      setMembers(await communityApi.get<Member[]>(`/community/hobby-groups/${group.id}/members`));
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Hobbies & interests"
      subtitle="Art, music, dance, theatre, books, discussions, teaching — find or start a group."
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Start a group'}</Button>}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={activeCategory === c.key ? 'primary' : 'outline'}
              onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hg-name">Group name</Label>
                  <Input id="hg-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sunday sketching circle" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hg-category">Category</Label>
                  <select
                    id="hg-category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as HobbyCategory }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hg-desc">Description (optional)</Label>
                  <Input id="hg-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Meet Sundays at the clubhouse, all levels welcome" />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.name} className="self-start">
                  {busy ? 'Creating…' : 'Create group'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              No groups here yet — be the first to start one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((g) => (
              <Card key={g.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <Palette className="h-5 w-5 text-primary-600" />
                      </span>
                      <div>
                        <p className="font-bold text-text">{g.name}</p>
                        <Badge variant="muted">{CATEGORIES.find((c) => c.key === g.category)?.label}</Badge>
                      </div>
                    </div>
                  </div>
                  {g.description && <p className="mt-3 text-sm text-text-secondary">{g.description}</p>}
                  <button
                    type="button"
                    onClick={() => toggleExpand(g)}
                    className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                  </button>

                  {expandedId === g.id && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      {membersLoading ? (
                        <p className="text-sm text-text-secondary">Loading…</p>
                      ) : members.length === 0 ? (
                        <p className="text-sm text-text-secondary">No members yet.</p>
                      ) : (
                        members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-text">{m.name}</span>
                            {m.phone && (
                              <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                                <Phone className="h-3.5 w-3.5" />
                                Call
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant={g.isMember ? 'outline' : 'primary'}
                    disabled={actionId === g.id}
                    onClick={() => toggleMembership(g)}
                    className="mt-4"
                  >
                    {actionId === g.id ? 'Please wait…' : g.isMember ? 'Leave group' : 'Join group'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CommunityPageFrame>
  );
}
