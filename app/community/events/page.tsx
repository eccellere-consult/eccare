'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { EventCard, EVENT_CATEGORY_LABEL, type CommunityEventData } from '@/components/community/event-card';
import { communityApi, useCommunityData } from '@/lib/community-client';

const CATEGORY_OPTIONS = (Object.keys(EVENT_CATEGORY_LABEL) as CommunityEventData['category'][]).map((key) => ({
  key,
  label: EVENT_CATEGORY_LABEL[key],
}));

export default function EventsPage() {
  const { data, loading, error, reload } = useCommunityData<CommunityEventData[]>('/community/events');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<CommunityEventData['category']>('other');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/events', {
        title,
        location: location || undefined,
        category,
        startsAt: new Date(startsAt).toISOString(),
      });
      setTitle('');
      setLocation('');
      setCategory('other');
      setStartsAt('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create event.');
    } finally {
      setBusy(false);
    }
  }

  async function rsvp(eventId: string, status: string) {
    await communityApi.put(`/community/events/${eventId}/rsvp`, { status });
    reload();
  }

  return (
    <CommunityPageFrame
      title="Community events"
      subtitle="What's happening in your neighbourhood."
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add event'}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="No events planned yet."
    >
      <div className="flex flex-col gap-4">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Event name</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali celebration" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ev-category">Category</Label>
                  <select
                    id="ev-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CommunityEventData['category'])}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="startsAt">Date and time</Label>
                  <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="location">Where</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Community hall" />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !title.trim() || !startsAt}>
                  {busy ? 'Adding…' : 'Add event'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((ev) => (
          <EventCard key={ev.id} event={ev} onRsvp={rsvp} showCategory />
        ))}
      </div>
    </CommunityPageFrame>
  );
}
