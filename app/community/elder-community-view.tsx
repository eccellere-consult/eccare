'use client';

import { useState } from 'react';
import { Megaphone, Users, Phone, Pin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCommunityData } from '@/lib/community-client';

interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
}
interface Neighbour {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  flatNumber: string | null;
  role: 'member' | 'committee' | 'admin' | null;
  isSelf: boolean;
  source: 'member' | 'contact';
}

const TABS = [
  ['announcements', 'Announcements', Megaphone],
  ['directory', 'Directory', Users],
] as const;

/** Read-only "[Elder]'s Community" mode — announcements + directory only, per
 *  the caregiver self-mode plan's explicit scope (no posting, managing, or
 *  RSVPing "as" the elder). Rendered by app/community/community-page-content.tsx
 *  when the caregiver's pill toggle is set to the elder; switching back to
 *  "My Community" is just the toggle above this, not a separate page. */
export function ElderCommunityView({ elderName, elderUserId }: { elderName: string; elderUserId: string }) {
  const [tab, setTab] = useState<'announcements' | 'directory'>('announcements');
  const notices = useCommunityData<Notice[]>(`/community/notices?elderUserId=${elderUserId}`);
  const directory = useCommunityData<Neighbour[]>(`/community/directory?elderUserId=${elderUserId}`);

  return (
    <div>
      <p className="text-text-secondary">
        Read-only — announcements and the neighbour directory for {elderName}&rsquo;s residents association.
      </p>

      <div className="mt-4 flex h-12 w-fit min-w-[18rem] items-center rounded-xl bg-primary-50 p-1">
        {TABS.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'announcements' ? (
          notices.loading ? (
            <p className="text-text-secondary">Loading…</p>
          ) : notices.error ? (
            <Card><CardContent className="py-8 text-center text-danger-600">{notices.error}</CardContent></Card>
          ) : (notices.data?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-text-secondary">
                {elderName} hasn&rsquo;t joined a community yet, or there are no announcements.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {notices.data!.map((n) => (
                <Card key={n.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold text-text">{n.title}</h2>
                      {n.pinned && (
                        <Badge variant="accent">
                          <Pin className="mr-1 h-3 w-3" /> Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-text">{n.body}</p>
                    <p className="mt-3 text-sm text-text-secondary">
                      {n.createdBy.name} · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : directory.loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : directory.error ? (
          <Card><CardContent className="py-8 text-center text-danger-600">{directory.error}</CardContent></Card>
        ) : (directory.data?.length ?? 0) === 0 ? (
          <Card><CardContent className="py-12 text-center text-text-secondary">No neighbours listed yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {directory.data!.map((n) => (
              <Card key={n.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
                    {n.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-text">{n.name}</p>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="truncate">{n.flatNumber ?? '—'}</span>
                      {n.role && n.role !== 'member' && <Badge variant="accent">Committee</Badge>}
                      {n.source === 'contact' && <Badge variant="muted">Added by neighbour</Badge>}
                    </div>
                  </div>
                  {n.phone && (
                    <a
                      href={`tel:${n.phone}`}
                      aria-label={`Call ${n.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
