'use client';

import { useState } from 'react';
import { Phone, Hand } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Neighbour {
  userId: string;
  name: string;
  phone: string | null;
  flatNumber: string | null;
  role: 'member' | 'committee' | 'admin';
  isSelf: boolean;
}

export default function DirectoryPage() {
  const { data, loading, error } = useCommunityData<Neighbour[]>('/community/directory');
  const [greeted, setGreeted] = useState<Record<string, string>>({});

  async function dropHello(n: Neighbour) {
    setGreeted((g) => ({ ...g, [n.userId]: 'sending' }));
    try {
      await communityApi.post('/community/greetings', { toUserId: n.userId });
      setGreeted((g) => ({ ...g, [n.userId]: 'sent' }));
    } catch {
      setGreeted((g) => ({ ...g, [n.userId]: 'failed' }));
    }
  }

  return (
    <CommunityPageFrame
      title="Your neighbours"
      subtitle="Say hello, or call directly."
      loading={loading}
      error={error}
      isEmpty={(data?.length ?? 0) === 0}
      emptyMessage="No neighbours listed yet."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((n) => (
          <Card key={n.userId}>
            <CardContent className="flex items-center gap-4 py-4">
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
                  {n.role !== 'member' && <Badge variant="accent">Committee</Badge>}
                </div>
              </div>

              {!n.isSelf && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => dropHello(n)}
                    disabled={greeted[n.userId] === 'sending' || greeted[n.userId] === 'sent'}
                    title="Drop a hello"
                    aria-label={`Say hello to ${n.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-600 disabled:opacity-50"
                  >
                    <Hand className="h-5 w-5" />
                  </button>
                  {n.phone && (
                    <a
                      href={`tel:${n.phone}`}
                      aria-label={`Call ${n.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
            {greeted[n.userId] === 'sent' && (
              <p className="px-6 pb-3 text-sm font-semibold text-success-600">Hello sent 👋</p>
            )}
            {greeted[n.userId] === 'failed' && (
              <p className="px-6 pb-3 text-sm text-danger-600">Could not send.</p>
            )}
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
