'use client';

import { useState } from 'react';
import { Link2, Home, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface PossibleMatch {
  id: string;
  reason: 'house_and_name' | 'name_only';
  member: { name: string; phone: string | null; flatNumber: string | null; status: string };
  entry: { id: string; name: string; phone: string | null; flatNumber: string | null };
}

function Person({ label, name, phone, house }: { label: string; name: string; phone: string | null; house: string | null }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 truncate font-bold text-text">{name}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
        <Home className="h-3.5 w-3.5 shrink-0" />
        {house ?? 'No house no.'}
      </p>
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Phone className="h-3.5 w-3.5 shrink-0" />
        {phone ?? 'No phone'}
      </p>
    </div>
  );
}

/** The committee's queue of "is this new member that directory entry?" questions.
 *  Only matches the system couldn't settle itself land here — the same phone
 *  number links automatically and never appears (see lib/directory-link.ts).
 *  Renders nothing when there's nothing to decide. */
export function DirectoryMatchReview({ neighborhoodId }: { neighborhoodId: string }) {
  const { data, reload } = useCommunityData<PossibleMatch[]>(
    `/community/directory/matches?neighborhoodId=${encodeURIComponent(neighborhoodId)}`,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function decide(match: PossibleMatch, action: 'link' | 'reject') {
    setBusyId(match.id);
    setError('');
    try {
      await communityApi.post(`/community/directory/matches/${match.id}`, { action });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that decision.');
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!data || data.length === 0) return null;

  return (
    <Card className="mb-6 border-accent-100 bg-accent-50">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Link2 className="h-5 w-5 text-accent-900" />
            Possible matches to confirm ({data.length})
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            These new members look like people already in the directory, but the phone numbers differ so we can&rsquo;t
            be sure. Confirming links them, so they aren&rsquo;t listed twice and their house number carries over.
          </p>
        </div>

        {data.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 rounded-xl bg-surface p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Person label="New member" name={m.member.name} phone={m.member.phone} house={m.member.flatNumber} />
              <Person label="Directory entry" name={m.entry.name} phone={m.entry.phone} house={m.entry.flatNumber} />
            </div>
            <p className="text-xs text-text-secondary">
              {m.reason === 'house_and_name'
                ? 'Same house number and a similar name.'
                : 'A near-identical name, with a house number missing on one side.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busyId === m.id} onClick={() => decide(m, 'link')}>
                Same person — link
              </Button>
              <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => decide(m, 'reject')}>
                Different people
              </Button>
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
