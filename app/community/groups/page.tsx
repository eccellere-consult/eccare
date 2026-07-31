'use client';

import { ExternalLink, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { useCommunityData } from '@/lib/community-client';

interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteUrl: string;
}

export default function WhatsAppGroupsPage() {
  const { data, loading, error } = useCommunityData<Group[]>('/community/whatsapp-groups');

  return (
    <CommunityPageFrame
      title="Community WhatsApp groups"
      subtitle="Tap to open WhatsApp and join."
      loading={loading}
      error={error}
      isEmpty={(data?.length ?? 0) === 0}
      emptyMessage="Your committee hasn't added any groups yet."
    >
      <div className="flex flex-col gap-3">
        {data?.map((g) => (
          <a key={g.id} href={g.inviteUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-50">
                  <MessageCircle className="h-5 w-5 text-success-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-text">{g.name}</span>
                  {g.description && (
                    <span className="block truncate text-sm text-text-secondary">{g.description}</span>
                  )}
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-text-secondary" />
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
