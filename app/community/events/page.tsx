'use client';

import { useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface CommunityEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  goingCount: number;
  myRsvp: 'going' | 'maybe' | 'not_going' | null;
  createdBy: { name: string };
}

const RSVPS = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't" },
] as const;

export default function EventsPage() {
  const { data, loading, error, reload } = useCommunityData<CommunityEvent[]>('/community/events');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
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
        startsAt: new Date(startsAt).toISOString(),
      });
      setTitle('');
      setLocation('');
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
          <Card key={ev.id}>
            <CardContent className="pt-6">
              <h2 className="text-lg font-bold text-text">{ev.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock className="h-3.5 w-3.5" />
                {new Date(ev.startsAt).toLocaleString()}
              </p>
              {ev.location && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
                  <MapPin className="h-3.5 w-3.5" />
                  {ev.location}
                </p>
              )}
              {ev.description && <p className="mt-2 text-text">{ev.description}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {RSVPS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => rsvp(ev.id, r.value)}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-sm font-semibold min-h-tap',
                      ev.myRsvp === r.value
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-border bg-surface text-text hover:bg-primary-50',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
                <span className="ml-auto text-sm text-text-secondary">{ev.goingCount} going</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
