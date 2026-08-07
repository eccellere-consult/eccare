'use client';

import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface CommunityEventData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: 'cultural' | 'local_tour' | 'movie' | 'social' | 'other';
  startsAt: string;
  goingCount: number;
  myRsvp: 'going' | 'maybe' | 'not_going' | null;
  createdBy: { name: string };
}

export const EVENT_CATEGORY_LABEL: Record<CommunityEventData['category'], string> = {
  cultural: 'Cultural',
  local_tour: 'Local tour',
  movie: 'Movie',
  social: 'Social',
  other: 'Other',
};

const RSVPS = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't" },
] as const;

/** One event card with RSVP controls — shared by /community/events (shows every
 *  event) and /community/entertainment (pre-filtered to social categories), so the
 *  rendering never drifts between the two views. */
export function EventCard({ event, onRsvp, showCategory }: { event: CommunityEventData; onRsvp: (eventId: string, status: string) => void; showCategory?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-text">{event.title}</h2>
          {showCategory && <Badge variant="accent">{EVENT_CATEGORY_LABEL[event.category]}</Badge>}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
          <Clock className="h-3.5 w-3.5" />
          {new Date(event.startsAt).toLocaleString()}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </p>
        )}
        {event.description && <p className="mt-2 text-text">{event.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {RSVPS.map((r) => (
            <button
              key={r.value}
              onClick={() => onRsvp(event.id, r.value)}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-semibold min-h-tap',
                event.myRsvp === r.value
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-border bg-surface text-text hover:bg-primary-50',
              )}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-text-secondary">{event.goingCount} going</span>
        </div>
      </CardContent>
    </Card>
  );
}
