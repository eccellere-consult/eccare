'use client';

import { useState } from 'react';
import { Phone, Hand, Pencil, Trash2, ShieldX, Star, Home, Search, Navigation, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { HouseField } from '@/components/house-field';
import { HouseLocationEditor } from '@/components/community/house-location-editor';
import { mapsDirectionsUrl } from '@/lib/geo';
import { normalizeHouseInput, houseKey } from '@/lib/house';
import { isValidAnyPhone } from '@/lib/validation';

interface RegisterResult {
  created: number;
  skipped: number;
  results: Array<{ id: string; name: string; status: 'created' | 'skipped'; reason?: string }>;
}

interface Neighbour {
  id: string;
  userId: string | null;
  contactId: string | null;
  memberId: string | null;
  unregisteredId: string | null;
  location: { lat: number; lng: number } | null;
  name: string;
  avatarUrl?: string | null;
  phone: string | null;
  flatNumber: string | null;
  role: 'member' | 'committee' | 'admin' | null;
  isSelf: boolean;
  source: 'member' | 'contact' | 'unregistered';
  isFavorite: boolean;
  canManage: boolean;
  canModerate: boolean;
}

/** A not-yet-registered entry the viewer (committee/admin) manages — can be ticked. */
const isRegisterCandidate = (n: Neighbour) => n.source === 'unregistered' && n.canManage && !!n.unregisteredId;
/** …and has a phone number it could actually sign in with. */
const canRegisterNow = (n: Neighbour) => isRegisterCandidate(n) && !!n.phone && isValidAnyPhone(n.phone);

/** The community's Local Directory — registered members, neighbour-added contacts
 *  and bulk-imported (not yet registered) residents. Used by the resident-facing
 *  /community/directory page and by the admin community's Directory tab.
 *
 *  `neighborhoodId` points it at a specific community (the admin tab — a platform
 *  admin isn't a member, so there's no "primary" community to default to).
 *  `adminView` hides the personal actions that only make sense for a member
 *  (favourite, say hello) and adds a search box. */
export function DirectoryList({
  neighborhoodId,
  adminView = false,
}: {
  neighborhoodId?: string;
  adminView?: boolean;
}) {
  const scope = neighborhoodId ? `?neighborhoodId=${encodeURIComponent(neighborhoodId)}` : '';
  const { data, loading, error, setData } = useCommunityData<Neighbour[]>(`/community/directory${scope}`);
  const [search, setSearch] = useState('');
  const [greeted, setGreeted] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFlatNumber, setEditFlatNumber] = useState('');
  const [editError, setEditError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Registering directory entries as members on their behalf (committee/admin).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regRole, setRegRole] = useState<'caregiver' | 'elder'>('caregiver');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');
  const [regResult, setRegResult] = useState<RegisterResult | null>(null);

  function toggleSelected(unregisteredId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unregisteredId)) next.delete(unregisteredId);
      else next.add(unregisteredId);
      return next;
    });
  }

  async function registerSelected() {
    if (regPassword.length < 8) {
      setRegError('Please set a starting password of at least 8 characters.');
      return;
    }
    setRegBusy(true);
    setRegError('');
    try {
      const res = await communityApi.post<RegisterResult>('/community/directory/unregistered/register', {
        neighborhoodId,
        ids: [...selected],
        role: regRole,
        password: regPassword,
      });
      // Registered people leave the "not yet registered" list — they're members now.
      const done = new Set(res.results.filter((r) => r.status === 'created').map((r) => r.id));
      setData((prev) => prev?.filter((x) => !(x.unregisteredId && done.has(x.unregisteredId))) ?? prev);
      setSelected(new Set());
      setRegPassword('');
      setRegisterOpen(false);
      setRegResult(res);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Could not register them. Please try again.');
    } finally {
      setRegBusy(false);
    }
  }

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

  /** Everyone in a house shares one location, so update every entry for that house. */
  function setHouseLocation(flat: string, loc: { lat: number; lng: number } | null) {
    const key = houseKey(flat);
    setData((prev) => prev?.map((x) => (x.flatNumber && houseKey(x.flatNumber) === key ? { ...x, location: loc } : x)) ?? prev);
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
        // House number is mandatory, in one structured form (lib/house.ts).
        const house = normalizeHouseInput(editFlatNumber);
        if (!house.ok) {
          setEditError(house.message);
          setBusyId(null);
          return;
        }
        await communityApi.patch(`/community/members/${n.memberId}`, {
          name: editName.trim(),
          flatNumber: house.value,
        });
        setData((prev) =>
          prev?.map((x) => (x.id === n.id ? { ...x, name: editName.trim(), flatNumber: house.value } : x)) ?? prev,
        );
      } else if (n.source === 'unregistered' && n.unregisteredId) {
        if (!editName.trim()) {
          setEditError('Please enter a name.');
          setBusyId(null);
          return;
        }
        const house = normalizeHouseInput(editFlatNumber);
        if (!house.ok) {
          setEditError(house.message);
          setBusyId(null);
          return;
        }
        await communityApi.patch(`/community/directory/unregistered/${n.unregisteredId}`, {
          name: editName.trim(),
          phone: editPhone.trim() || null,
          flatNumber: house.value,
        });
        setData((prev) =>
          prev?.map((x) =>
            x.id === n.id
              ? { ...x, name: editName.trim(), phone: editPhone.trim() || null, flatNumber: house.value }
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
      await communityApi.delete(`/community/directory/${n.contactId}${scope}`);
      setData((prev) => prev?.filter((x) => x.id !== n.id) ?? prev);
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
      </Card>
    );
  }
  if ((data?.length ?? 0) === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-text-secondary">No neighbours listed yet.</CardContent>
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const visible = (data ?? []).filter(
    (n) => !q || n.name.toLowerCase().includes(q) || n.phone?.includes(q) || n.flatNumber?.toLowerCase().includes(q),
  );

  const registrable = visible.filter(canRegisterNow);
  const allRegistrableSelected =
    registrable.length > 0 && registrable.every((n) => n.unregisteredId && selected.has(n.unregisteredId));
  const selectedPeople = (data ?? []).filter((n) => n.unregisteredId && selected.has(n.unregisteredId));

  return (
    <div className="flex flex-col gap-3">
      {regResult && (
        <Card className="border-success-100 bg-success-50">
          <CardContent className="flex flex-col gap-2 py-4">
            <p className="font-bold text-text">
              {regResult.created === 0
                ? 'Nobody was registered.'
                : `Registered ${regResult.created} ${regResult.created === 1 ? 'person' : 'people'}.`}
              {regResult.skipped > 0 && ` ${regResult.skipped} skipped.`}
            </p>
            {regResult.created > 0 && (
              <p className="text-sm text-text-secondary">
                They can now sign in with their phone number and the password you set — please tell them what it is.
              </p>
            )}
            {regResult.results.filter((r) => r.status === 'skipped').length > 0 && (
              <ul className="list-disc pl-5 text-sm text-text-secondary">
                {regResult.results
                  .filter((r) => r.status === 'skipped')
                  .map((r) => (
                    <li key={r.id}>
                      <span className="font-semibold text-text">{r.name}</span> — {r.reason}
                    </li>
                  ))}
              </ul>
            )}
            <div>
              <Button size="sm" variant="outline" onClick={() => setRegResult(null)}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(data ?? []).some(isRegisterCandidate) && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary-600"
                  checked={allRegistrableSelected}
                  disabled={registrable.length === 0}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const n of registrable) {
                        if (!n.unregisteredId) continue;
                        if (allRegistrableSelected) next.delete(n.unregisteredId);
                        else next.add(n.unregisteredId);
                      }
                      return next;
                    })
                  }
                />
                Select everyone not yet registered ({registrable.length})
              </label>
              <span className="text-sm text-text-secondary">{selected.size} selected</span>
              <div className="flex gap-2 sm:ml-auto">
                {selected.size > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={() => {
                    setRegisterOpen((o) => !o);
                    setRegError('');
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Register {selected.size > 0 ? selected.size : ''} as {selected.size === 1 ? 'a member' : 'members'}
                </Button>
              </div>
            </div>

            {registerOpen && selected.size > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <p className="text-sm text-text-secondary">
                  This creates an account for each of the {selected.size} selected{' '}
                  {selected.size === 1 ? 'person' : 'people'} and adds them to the community, with the same house
                  number and phone number as the directory. They sign in with their phone number and the starting
                  password below.
                </p>
                <ul className="max-h-32 overflow-y-auto rounded-lg bg-primary-50 px-3 py-2 text-sm text-text">
                  {selectedPeople.map((n) => (
                    <li key={n.id} className="truncate">
                      <span className="font-semibold">{n.name}</span>
                      <span className="text-text-secondary">
                        {n.flatNumber ? ` · ${n.flatNumber}` : ''} · {n.phone}
                      </span>
                    </li>
                  ))}
                </ul>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold text-text">Register them as</legend>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="reg-role"
                      className="h-5 w-5 accent-primary-600"
                      checked={regRole === 'caregiver'}
                      onChange={() => setRegRole('caregiver')}
                    />
                    Family members (under 60)
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="reg-role"
                      className="h-5 w-5 accent-primary-600"
                      checked={regRole === 'elder'}
                      onChange={() => setRegRole('elder')}
                    />
                    Elders (60 and over)
                  </label>
                  <p className="text-xs text-text-secondary">
                    The directory doesn&rsquo;t hold dates of birth, so choose for this whole group — register elders
                    and family members separately. Each person is asked for their date of birth when they first sign
                    in.
                  </p>
                </fieldset>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-password">Starting password (same for everyone, at least 8 characters)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((s) => !s)}
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary"
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {regError && <p className="text-sm text-danger-600">{regError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={regBusy} onClick={registerSelected}>
                    {regBusy ? 'Registering…' : `Register ${selected.size} now`}
                  </Button>
                  <Button size="sm" variant="outline" disabled={regBusy} onClick={() => setRegisterOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {adminView && (
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, house no. or phone"
            className="pl-9"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((n) =>
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
                    <HouseField id={`nb-flat-${n.id}`} value={editFlatNumber} onChange={setEditFlatNumber} />
                    {n.flatNumber && (
                      <HouseLocationEditor
                        neighborhoodId={neighborhoodId}
                        house={n.flatNumber}
                        current={n.location}
                        onChange={(loc) => setHouseLocation(n.flatNumber!, loc)}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`nb-name-${n.id}`}>Name</Label>
                      <Input id={`nb-name-${n.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <HouseField id={`nb-flat-${n.id}`} value={editFlatNumber} onChange={setEditFlatNumber} />
                    {n.flatNumber && (
                      <HouseLocationEditor
                        neighborhoodId={neighborhoodId}
                        house={n.flatNumber}
                        current={n.location}
                        onChange={(loc) => setHouseLocation(n.flatNumber!, loc)}
                      />
                    )}
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
            <Card key={n.id} className={`@container ${n.unregisteredId && selected.has(n.unregisteredId) ? 'ring-2 ring-primary-600' : ''}`}>
              <CardContent className="flex flex-col gap-3 py-4 @lg:flex-row @lg:items-center @lg:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {isRegisterCandidate(n) && (
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-primary-600"
                      checked={!!n.unregisteredId && selected.has(n.unregisteredId)}
                      disabled={!canRegisterNow(n)}
                      onChange={() => n.unregisteredId && toggleSelected(n.unregisteredId)}
                      aria-label={`Select ${n.name} to register`}
                      title={canRegisterNow(n) ? 'Select to register' : 'Add a valid phone number to register this person'}
                    />
                  )}
                  {n.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full bg-primary-50 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
                      {n.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-text">
                      {n.name} {n.isSelf && <span className="text-text-secondary">(you)</span>}
                    </p>
                    {/* A div, not a p — Badge renders a div, which is invalid inside a
                        paragraph and causes a React hydration error. */}
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      {/* The house number is the main thing a neighbour looks up here,
                          so it gets its own icon and weight rather than a faint trailing
                          dash. A neighbour-added contact has no house concept at all. */}
                      {n.source !== 'contact' &&
                        (n.flatNumber ? (
                          <span className="flex items-center gap-1 truncate font-semibold text-text">
                            <Home className="h-3.5 w-3.5 shrink-0" />
                            {n.flatNumber}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 truncate">
                            <Home className="h-3.5 w-3.5 shrink-0" />
                            House no. not added
                          </span>
                        ))}
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
                    once the card itself is wide enough (container query, not the
                    screen width — in a two-column grid a card can be narrow on a wide
                    screen) that it sits inline with the name on a single row. */}
                <div className="flex flex-wrap justify-start gap-2 @lg:justify-end @lg:shrink-0">
                  {!n.isSelf && !adminView && (
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
                  {n.source === 'member' && !n.isSelf && !adminView && (
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
                  {n.location && (
                    <a
                      href={mapsDirectionsUrl(n.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Directions to ${n.name}'s house`}
                      title="Directions to this house"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-600"
                    >
                      <Navigation className="h-5 w-5" />
                    </a>
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
    </div>
  );
}
