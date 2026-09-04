'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { TourButton } from '@/components/tour/TourButton';
import { communityApi } from '@/lib/community-client';

export default function JoinCommunityPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await communityApi.post('/community/join', {
        joinCode: joinCode.trim(),
        flatNumber: flatNumber.trim() || undefined,
      });
      router.push('/community');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Join your community"
      subtitle="Enter the code shared by your management committee."
    >
      <div className="max-w-lg">
        <TourButton tourId="joinCommunity" />
      </div>

      <Card className="mt-3 max-w-lg">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="joinCode">Community code</Label>
              <Input
                id="joinCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                className="text-lg tracking-widest"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="flatNumber">Flat / house number (optional)</Label>
              <Input
                id="flatNumber"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="A-402"
              />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" size="lg" disabled={busy || joinCode.trim().length < 4}>
              {busy ? 'Joining…' : 'Join community'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CommunityPageFrame>
  );
}
