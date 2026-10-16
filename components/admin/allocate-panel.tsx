'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Loader2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeHouseInput } from '@/lib/house';
import { cn } from '@/lib/utils';

export interface AllocCommunity {
  id: string;
  name: string;
  place: string;
  members: number;
  housePrefix: string | null;
}
export interface AllocPerson {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** A join request they already made, if any — pre-fills the house. */
  pending: { communityId: string; house: string | null }[];
}
interface Result {
  userId: string;
  name: string;
  status: 'allocated' | 'approved' | 'skipped';
  reason?: string;
  house?: string;
}

/** Puts the chosen people into a community, approved at once: pick the community from a list,
 *  confirm each person's house (a bare number gets the community's usual prefix), choose their role,
 *  and save. People who had already asked to join are approved the same way. */
export function AllocatePanel({
  people,
  communities,
  onClose,
}: {
  people: AllocPerson[];
  communities: AllocCommunity[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [communityId, setCommunityId] = useState<string | null>(communities.length === 1 ? communities[0].id : null);
  const [role, setRole] = useState<'member' | 'committee' | 'admin'>('member');
  const [houses, setHouses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ community: string; list: Result[] } | null>(null);

  const community = communities.find((c) => c.id === communityId) ?? null;
  const houseFor = (p: AllocPerson) => houses[p.id] ?? p.pending.find((x) => x.communityId === communityId)?.house ?? '';
  const checks = people.map((p) => ({ person: p, value: houseFor(p), check: normalizeHouseInput(houseFor(p), { defaultBlock: community?.housePrefix ?? undefined }) }));
  const ready = Boolean(community) && checks.every((c) => c.check.ok);

  async function save() {
    if (!community) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/community-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ neighborhoodId: community.id, role, users: checks.map((c) => ({ userId: c.person.id, house: c.value })) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not allocate these people.');
      setResults({ community: json.data.community, list: json.data.results });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not allocate these people.');
    } finally {
      setBusy(false);
    }
  }

  if (results) {
    const done = results.list.filter((r) => r.status !== 'skipped');
    const skipped = results.list.filter((r) => r.status === 'skipped');
    return (
      <Card className="mt-4 border-success-100 bg-success-50">
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="flex items-center gap-2 font-bold text-text">
            <Check className="h-5 w-5 text-success-600" />
            {done.length} {done.length === 1 ? 'person' : 'people'} added to {results.community}
            {skipped.length > 0 && <span className="font-normal text-text-secondary"> — {skipped.length} skipped</span>}
          </p>
          {done.length > 0 && (
            <ul className="text-sm text-text-secondary">
              {done.map((r) => (
                <li key={r.userId}>
                  <span className="font-semibold text-text">{r.name}</span> — {r.house}
                  {r.status === 'approved' ? ' (request approved)' : ''}
                </li>
              ))}
            </ul>
          )}
          {skipped.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-danger-600">
              {skipped.map((r) => (
                <li key={r.userId}>
                  <span className="font-semibold">{r.name}</span> — {r.reason}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-secondary">They can open the community from their home screen straight away.</p>
          <div>
            <Button size="sm" variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-primary-100">
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <UserPlus className="h-5 w-5 text-primary-600" />
            Add {people.length} {people.length === 1 ? 'person' : 'people'} to a community
          </h2>
          <p className="mt-1 text-sm text-text-secondary">They are approved straight away and can use the community as soon as they open the app.</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-text">1. Choose the community</p>
          {communities.length === 0 ? (
            <p className="text-sm text-text-secondary">There are no communities yet. Create one under Communities first.</p>
          ) : (
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {communities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === communityId}
                  onClick={() => setCommunityId(c.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                    c.id === communityId ? 'border-primary-600 bg-primary-50' : 'border-border bg-surface hover:border-primary-300',
                  )}
                >
                  <Building2 className="h-6 w-6 shrink-0 text-primary-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-text">{c.name}</span>
                    <span className="block truncate text-xs text-text-secondary">
                      {[c.place, `${c.members} members`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {c.id === communityId && <Check className="h-5 w-5 shrink-0 text-primary-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {community && (
          <>
            <div>
              <p className="mb-1 text-sm font-semibold text-text">2. Confirm each person&rsquo;s house</p>
              <p className="mb-2 text-xs text-text-secondary">
                {community.housePrefix
                  ? `Typing just the number is fine — ${community.housePrefix}- is added. A house name works too.`
                  : 'Block or association with the number (like GRA-105), or a house name.'}
              </p>
              <ul className="flex flex-col gap-2">
                {checks.map(({ person, value, check }) => (
                  <li key={person.id} className="flex flex-col gap-1 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 sm:w-56">
                      <p className="truncate font-semibold text-text">{person.name}</p>
                      <p className="truncate text-xs text-text-secondary">{person.phone ?? person.email ?? ''}</p>
                    </div>
                    <Input
                      value={value}
                      onChange={(e) => setHouses((h) => ({ ...h, [person.id]: e.target.value.toUpperCase() }))}
                      autoCapitalize="characters"
                      aria-label={`House for ${person.name}`}
                      placeholder={community.housePrefix ? `${community.housePrefix}-27` : 'GRA-105'}
                      className="sm:max-w-48"
                    />
                    <span className={cn('text-sm', check.ok ? 'font-semibold text-success-600' : value.trim() ? 'text-danger-600' : 'text-text-secondary')}>
                      {check.ok ? `→ ${check.value}` : value.trim() ? check.message : 'Enter the house'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-text">3. Their role in the community</p>
              <div className="flex flex-wrap gap-2">
                {([['member', 'Member'], ['committee', 'Committee member'], ['admin', 'Community admin']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={role === value}
                    onClick={() => setRole(value)}
                    className={cn(
                      'rounded-full border-2 px-4 py-2 text-sm font-semibold',
                      role === value ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary hover:border-primary-300',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !ready} onClick={save}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {busy ? 'Adding…' : `Add to ${community?.name ?? 'community'}`}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
