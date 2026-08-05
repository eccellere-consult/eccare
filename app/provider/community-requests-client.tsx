'use client';

import { useEffect, useState } from 'react';
import { Building2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CommunityRequest {
  id: string;
  status: 'pending' | 'communityApproved' | 'approved' | 'rejected';
  rejectionReason: string | null;
  neighborhood: { id: string; name: string };
}

const STATUS_VARIANT = {
  pending: 'accent',
  communityApproved: 'accent',
  approved: 'success',
  rejected: 'danger',
} as const;

const STATUS_LABEL = {
  pending: 'Awaiting community approval',
  communityApproved: 'Awaiting platform approval',
  approved: 'Listed',
  rejected: 'Rejected',
} as const;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

export function CommunityRequestsClient() {
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRequests(await api('/provider/community-requests'));
    } catch {
      /* leave the list empty — nothing critical if this fails to load */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api('/provider/community-requests', {
        method: 'POST',
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });
      setJoinCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary-600" />
          Join a community
        </CardTitle>
        <CardDescription>
          Request to be listed as a vendor in a specific community. The community&rsquo;s own
          committee approves first, then EC gives final approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleRequest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="join-code">Community join code</Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. TEST01"
            />
          </div>
          <Button type="submit" disabled={busy || !joinCode.trim()}>
            <Send className="h-4 w-4" />
            {busy ? 'Sending…' : 'Request'}
          </Button>
        </form>
        {error && <p className="text-sm text-danger-600">{error}</p>}

        {!loading && requests.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="font-semibold text-text">{r.neighborhood.name}</p>
                  {r.status === 'rejected' && r.rejectionReason && (
                    <p className="mt-0.5 text-xs text-danger-600">{r.rejectionReason}</p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
