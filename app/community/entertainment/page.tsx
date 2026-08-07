'use client';

import { useState } from 'react';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { EventCard, type CommunityEventData } from '@/components/community/event-card';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';

const SOCIAL_CATEGORIES: CommunityEventData['category'][] = ['cultural', 'local_tour', 'movie', 'social'];

/** A pre-filtered view of the same CommunityEvent data /community/events already
 *  renders — cultural activities, local tours, and movies, without the maintenance-
 *  window/AGM-notice noise a resident isn't browsing this page to find. Adding a
 *  new event here still happens on the main Events page, which has every category. */
export default function EntertainmentPage() {
  const { data, loading, error, reload } = useCommunityData<CommunityEventData[]>('/community/events');
  const [activeCategory, setActiveCategory] = useState<CommunityEventData['category'] | null>(null);

  const filtered = (data ?? []).filter(
    (ev) => SOCIAL_CATEGORIES.includes(ev.category) && (!activeCategory || ev.category === activeCategory),
  );

  async function rsvp(eventId: string, status: string) {
    await communityApi.put(`/community/events/${eventId}/rsvp`, { status });
    reload();
  }

  return (
    <CommunityPageFrame
      title="Entertainment & Social"
      subtitle="Cultural activities, local tours, and movies happening nearby."
      loading={loading}
      error={error}
      isEmpty={filtered.length === 0}
      emptyMessage="Nothing planned here yet — check Events to add one."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
            All
          </Button>
          <Button size="sm" variant={activeCategory === 'cultural' ? 'primary' : 'outline'} onClick={() => setActiveCategory(activeCategory === 'cultural' ? null : 'cultural')}>
            Cultural
          </Button>
          <Button size="sm" variant={activeCategory === 'local_tour' ? 'primary' : 'outline'} onClick={() => setActiveCategory(activeCategory === 'local_tour' ? null : 'local_tour')}>
            Local tours
          </Button>
          <Button size="sm" variant={activeCategory === 'movie' ? 'primary' : 'outline'} onClick={() => setActiveCategory(activeCategory === 'movie' ? null : 'movie')}>
            Movies
          </Button>
          <Button size="sm" variant={activeCategory === 'social' ? 'primary' : 'outline'} onClick={() => setActiveCategory(activeCategory === 'social' ? null : 'social')}>
            Social
          </Button>
        </div>

        {filtered.map((ev) => (
          <EventCard key={ev.id} event={ev} onRsvp={rsvp} showCategory />
        ))}
      </div>
    </CommunityPageFrame>
  );
}
