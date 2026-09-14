'use client';

import { useState } from 'react';
import { Phone, Hand, Pencil, Trash2, ShieldX, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Neighbour {
  id: string;
  userId: string | null;
  contactId: string | null;
  memberId: string | null;
  unregisteredId: string | null;
  name: string;
  phone: string | null;
  flatNumber: string | null;
  role: 'member' | 'committee' | 'admin' | null;
  isSelf: boolean;
  source: 'member' | 'contact' | 'unregistered';
  isFavorite: boolean;
  canManage: boolean;
  canModerate: boolean;
}

export default function DirectoryPage() {
  const { data, loading, error, setData } = useCommunityData<Neighbour[]>('/community/directory');
  const [greeted, setGreeted] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFlatNumber, setEditFlatNumber] = useState('');
  const [editError, setEditError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function withFavoriteSet(list: Neighbour[] | null, id: string, favorite: boolean): Neighbour[] | null {
    if (!list) return list;
    return list
      .map((x) => (x.id === id ? { ...x, isFavorite: favorite } : x))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }

  async function toggleFavorite(n: Neighbour) {
    const next = !n.isFavorite;
    // Optimistic — re-sort immediately rather than waiting on the round-trip,
    // same favorites-first order the backend itself applies.
    setData((prev) => withFavoriteSet(prev, n.id, next));
    try {
      if (next) {
        await communityApi.post('/community/directory/favorites', { entryKey: n.id });
      } else {
        await communityApi.delete(`/community/directory/favorites/${encodeURIComponent(n.id)}`);
      }
    } catch {
      // Revert on failure — the optimistic flip didn't actually stick server-side.
      setData((prev) => withFavoriteSet(prev, n.id, !next));
    }
  }

  async function dropHello(n: Neighbour) {
    if (!n.userId) return;
    setGreeted((g) => ({ ...g, [n.id]: 'sending' }));
    try {
      await communityApi.post('/community/greetings', { toUserId: n.userId });
      setGreeted((g) => ({ ...g, [n.id]: 'sent' }));
    } catch {
      setGreeted((g) => ({ ...g, [n.id]: 'failed' }));
    }
  }

  function startEdit(n: Neighbour) {
    setEditingId(n.id);
    setEditName(n.name);
    setEditPhone(n.phone ?? '');
    setEditFlatNumber(n.flatNumber ?? '');
    setEditError('');
  }

  async function saveEdit(n: Neighbour) {
    setBusyId(n.id);
    setEditError('');
    try {
      if (n.source === 'contact' && n.contactId) {
        if (!editName.trim() || !editPhone.trim()) {
          setEditError('Please enter a name and phone number.');
          setBusyId(null);
          return;
        }
        await communityApi.patch(`/contacts/${n.contactId}`, { name: editName, phone: editPhone });
        setData((prev) =>
          prev?.map((x) => (x.id === n.id ? { ...x, name: editName, phone: editPhone } : x)) ?? prev,
        );
      } else if (n.source === 'member' && n.memberId) {
        if (!editName.trim()) {
          setEditError("Please enter this resident's name.");
          setBusyId(null);
          return;
        }
        await communityApi.patch(`/community/members/${n.memberId}`, {
          name: editName.trim(),
          flatNumber: editFlatNumber || null,
        });
        setData((prev) =>
          prev?.map((x) => (x.id === n.id ? { ...x, name: editName.trim(), flatNumber: editFlatNumber || null } : x)) ?? prev,
        );
      } else if (n.source === 'unregistered' && n.unregisteredId) {
        if (!editName.trim()) {
          setEditError('Please enter a name.');
          setBusyId(null);
          return;
        }
        await communityApi.patch(`/community/directory/unregistered/${n.unregisteredId}`, {
          name: editName.trim(),
          phone: editPhone.trim() || null,
          flatNumber: editFlatNumber.trim() || null,
        });
        setData((prev) =>
          prev?.map((x) =>
            x.id === n.id
              ? { ...x, name: editName.trim(), phone: editPhone.trim() || null, flatNumber: editFlatNumber.trim() || null }
              : x,
          ) ?? prev,
        );
      }
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(n: Neighbour) {
    setBusyId(n.id);
    try {
      if (n.source === 'contact' && n.contactId) {
        await communityApi.delete(`/contacts/${n.contactId}`);
      } else if (n.source === 'member' && n.memberId) {
        if (!confirm(`Remove ${n.name} from this community? They would need to rejoin with the join code.`)) {
          setBusyId(null);
          return;
        }
        await communityApi.delete(`/community/members/${n.memberId}`);
      } else if (n.source === 'unregistered' && n.unregisteredId) {
        if (!confirm(`Remove ${n.name} from the directory?`)) {
          setBusyId(null);
          return;
        }
        await communityApi.delete(`/community/directory/unregistered/${n.unregisteredId}`);
      }
      setData((prev) => prev?.filter((x) => x.id !== n.id) ?? prev);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not remove.');
    } finally {
      setBusyId(null);
    }
  }

  /** Moderator-only: unpublish a shared contact from this directory without
   *  touching the owner's personal contact-book entry. */
  async function handleModerateRemove(n: Neighbour) {
    if (!n.contactId) return;
    if (!confirm(`Remove ${n.name} from the community directory? This doesn't delete it from the owner's own contacts.`)) return;
    setBusyId(n.id);
    try {
      await communityApi.delete(`/community/directory/${n.contactId}`);
      setData((prev) => prev?.filter((x) => x.id !== n.id) ?? prev);
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CommunityPageFrame
      title="Local Directory"
      subtitle="Say hello, call directly, or star a neighbour to keep them at the top."
      loading={loading}
      error={error}
      isEmpty={(data?.length ?? 0) === 0}
      emptyMessage="No neighbours listed yet."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((n) =>
          editingId === n.id ? (
            <Card key={n.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                {n.source === 'contact' ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-name-${n.id}`}>Name</Label>
                      <Input id={`nb-name-${n.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-phone-${n.id}`}>Phone number</Label>
                      <Input id={`nb-phone-${n.id}`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </>
                ) : n.source === 'unregistered' ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-name-${n.id}`}>Name</Label>
                      <Input id={`nb-name-${n.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-phone-${n.id}`}>Phone number (optional)</Label>
                      <Input id={`nb-phone-${n.id}`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-flat-${n.id}`}>Flat / house number</Label>
                      <Input
                        id={`nb-flat-${n.id}`}
                        value={editFlatNumber}
                        onChange={(e) => setEditFlatNumber(e.target.value)}
                        placeholder="A-101"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-name-${n.id}`}>Name</Label>
                      <Input id={`nb-name-${n.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-flat-${n.id}`}>Flat / house number</Label>
                      <Input
                        id={`nb-flat-${n.id}`}
                        value={editFlatNumber}
                        onChange={(e) => setEditFlatNumber(e.target.value)}
                        placeholder="A-101"
                      />
                    </div>
                  </>
                )}
                {editError && <p className="text-sm text-danger-600">{editError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busyId === n.id} onClick={() => saveEdit(n)}>
                    {busyId === n.id ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={n.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
                    {n.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-text">
                      {n.name} {n.isSelf && <span className="text-text-secondary">(you)</span>}
                    </p>
                    {/* A div, not a p — Badge renders a div, which is invalid inside a
                        paragraph and causes a React hydration error. */}
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="truncate">{n.flatNumber ?? '—'}</span>
                      {n.role && n.role !== 'member' && <Badge variant="accent">Committee</Badge>}
                      {n.source === 'contact' && <Badge variant="muted">Added by neighbour</Badge>}
                      {n.source === 'unregistered' && <Badge variant="muted">Not yet registered</Badge>}
                    </div>
                  </div>
                </div>

                {/* Its own row on mobile (flex-col above splits this out), inline
                    on sm+ — up to 5 icons here (favourite/hello/call/edit/delete)
                    crushed the name column to near-nothing on a phone-width
                    single row. flex-wrap is a safety net for anything narrower
                    still. Edit/Delete/Remove match the same 44px circular
                    footprint as the others instead of the wider default Button,
                    so the row takes less width to begin with. Left-aligned on
                    mobile so the icon row starts under the name/avatar above it
                    instead of jumping to the opposite edge; right-aligned again
                    on sm+ where it sits inline with the name on a single row. */}
                <div className="flex flex-wrap justify-start gap-2 sm:justify-end sm:shrink-0">
                  {!n.isSelf && (
                    <button
                      onClick={() => toggleFavorite(n)}
                      title={n.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                      aria-label={n.isFavorite ? `Remove ${n.name} from favourites` : `Add ${n.name} to favourites`}
                      aria-pressed={n.isFavorite}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-600"
                    >
                      <Star className="h-5 w-5" fill={n.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  )}
                  {n.source === 'member' && !n.isSelf && (
                    <button
                      onClick={() => dropHello(n)}
                      disabled={greeted[n.id] === 'sending' || greeted[n.id] === 'sent'}
                      title="Drop a hello"
                      aria-label={`Say hello to ${n.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-600 disabled:opacity-50"
                    >
                      <Hand className="h-5 w-5" />
                    </button>
                  )}
                  {n.phone && (
                    <a
                      href={`tel:${n.phone}`}
                      aria-label={`Call ${n.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                  {n.canManage && (
                    <>
                      <button
                        disabled={busyId === n.id}
                        onClick={() => startEdit(n)}
                        aria-label={`Edit ${n.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        disabled={busyId === n.id}
                        onClick={() => handleDelete(n)}
                        aria-label={`Remove ${n.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {!n.canManage && n.canModerate && n.source === 'contact' && (
                    <button
                      disabled={busyId === n.id}
                      onClick={() => handleModerateRemove(n)}
                      aria-label={`Remove ${n.name} from directory`}
                      title="Remove from community directory"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                    >
                      <ShieldX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
              {greeted[n.id] === 'sent' && (
                <p className="px-6 pb-3 text-sm font-semibold text-success-600">Hello sent 👋</p>
              )}
              {greeted[n.id] === 'failed' && (
                <p className="px-6 pb-3 text-sm text-danger-600">Could not send.</p>
              )}
            </Card>
          ),
        )}
      </div>
    </CommunityPageFrame>
  );
}
