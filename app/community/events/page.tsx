'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { EventCard, EVENT_CATEGORY_LABEL_KEY, type CommunityEventData } from '@/components/community/event-card';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

const CATEGORY_OPTIONS = (Object.keys(EVENT_CATEGORY_LABEL_KEY) as CommunityEventData['category'][]).map((key) => ({
  key,
  labelKey: EVENT_CATEGORY_LABEL_KEY[key],
}));

export default function EventsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, reload } = useCommunityData<CommunityEventData[]>('/community/events');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<CommunityEventData['category']>('other');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommunityEventData['category'] | null>(null);

  const filtered = (data ?? []).filter((ev) => !activeCategory || ev.category === activeCategory);

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
      setFormError(err instanceof Error ? err.message : t('community.events.couldNotCreate'));
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
      title={t('community.events.title')}
      subtitle={t('community.events.subtitle')}
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.events.addEvent')}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && filtered.length === 0}
      emptyMessage={t('community.events.noEvents')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
            {t('common.all')}
          </Button>
          {CATEGORY_OPTIONS.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={activeCategory === c.key ? 'primary' : 'outline'}
              onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            >
              {t(c.labelKey)}
            </Button>
          ))}
        </div>

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">{t('community.events.eventName')}</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('community.events.eventNamePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ev-category">{t('community.events.category')}</Label>
                  <select
                    id="ev-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CommunityEventData['category'])}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.key} value={c.key}>{t(c.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="startsAt">{t('community.events.dateAndTime')}</Label>
                  <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="location">{t('community.events.where')}</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('community.events.wherePlaceholder')} />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !title.trim() || !startsAt}>
                  {busy ? t('community.events.adding') : t('community.events.addEvent')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.map((ev) => (
          <EventCard key={ev.id} event={ev} onRsvp={rsvp} showCategory />
        ))}
      </div>
    </CommunityPageFrame>
  );
}
