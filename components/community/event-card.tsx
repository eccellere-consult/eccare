'use client';

import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

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

// English labels stay the source of truth for callers that need a plain
// string (e.g. building the category filter chips before a language is
// known); EVENT_CATEGORY_LABEL_KEY is what the card itself renders with.
export const EVENT_CATEGORY_LABEL: Record<CommunityEventData['category'], string> = {
  cultural: 'Cultural',
  local_tour: 'Local tour',
  movie: 'Movie',
  social: 'Social',
  other: 'Other',
};
export const EVENT_CATEGORY_LABEL_KEY: Record<CommunityEventData['category'], TranslationKey> = {
  cultural: 'shared.eventCard.category.cultural',
  local_tour: 'shared.eventCard.category.localTour',
  movie: 'shared.eventCard.category.movie',
  social: 'shared.eventCard.category.social',
  other: 'shared.eventCard.category.other',
};

const RSVPS = [
  { value: 'going', labelKey: 'shared.eventCard.rsvp.going' },
  { value: 'maybe', labelKey: 'shared.eventCard.rsvp.maybe' },
  { value: 'not_going', labelKey: 'shared.eventCard.rsvp.notGoing' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];

/** One event card with RSVP controls, rendered by /community/events — the single
 *  merged "Entertainment & Social Events" page (previously split across a separate
 *  /community/events and /community/entertainment; the category filter chips on
 *  that page now do what the second page used to). */
export function EventCard({ event, onRsvp, showCategory }: { event: CommunityEventData; onRsvp: (eventId: string, status: string) => void; showCategory?: boolean }) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-text">{event.title}</h2>
          {showCategory && <Badge variant="accent">{t(EVENT_CATEGORY_LABEL_KEY[event.category])}</Badge>}
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
              {t(r.labelKey)}
            </button>
          ))}
          <span className="ml-auto text-sm text-text-secondary">{event.goingCount} {t('shared.eventCard.goingSuffix')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
