'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CommunityHubClient } from './community-hub-client';
import { ElderCommunityView } from './elder-community-view';

interface Identity {
  id: string;
  name: string;
}

/** Same pill-toggle shape as the Contacts/Orders/Payments/Services "For [Elder] /
 *  For myself" toggle, but labeled "My Community" / "[Elder]'s Community" per
 *  the caregiver's own wording, and — deliberately — defaulting to `'self'`
 *  rather than `'elder'`. Every other toggle defaults to the elder because
 *  those pages exist primarily to manage something for the elder; /community
 *  was already the caregiver's own long-standing hub before any of this, so
 *  defaulting away from that would regress today's primary use of the page. */
export function CommunityPageContent({
  elder,
  self,
}: {
  /** null when the caregiver has no accepted elder yet, or the viewer is an
   *  elder themselves — the toggle never renders in either case. */
  elder: Identity | null;
  self: Identity;
}) {
  const [actingAs, setActingAs] = useState<'self' | 'elder'>('self');

  return (
    <div>
      {elder && (
        <div className="mb-6 flex h-12 w-fit min-w-[16rem] items-center rounded-xl bg-primary-50 p-1">
          {(
            [
              ['self', 'My Community'],
              ['elder', `${elder.name}'s Community`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActingAs(value)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                actingAs === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {actingAs === 'elder' && elder ? (
        <ElderCommunityView elderName={elder.name} elderUserId={elder.id} />
      ) : (
        <CommunityHubClient />
      )}
    </div>
  );
}
