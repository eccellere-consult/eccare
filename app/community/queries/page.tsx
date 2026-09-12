'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { QueryThread } from '@/components/query-thread';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Query {
  id: string;
  type: 'committee' | 'helpdesk';
  category: HelpdeskCategory | null;
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  user: { id: string; name: string };
  _count: { replies: number };
}
interface Me { memberships: { role: string }[] }

type HelpdeskCategory = 'water' | 'electricity' | 'cleaning' | 'safety' | 'cultural' | 'driver' | 'other';
const HELPDESK_CATEGORIES: { key: HelpdeskCategory; labelKey: TranslationKey }[] = [
  { key: 'water', labelKey: 'community.queries.categoryWater' },
  { key: 'electricity', labelKey: 'community.queries.categoryElectricity' },
  { key: 'cleaning', labelKey: 'community.queries.categoryCleaning' },
  { key: 'safety', labelKey: 'community.queries.categorySafety' },
  { key: 'cultural', labelKey: 'community.queries.categoryCultural' },
  { key: 'driver', labelKey: 'community.queries.categoryDriver' },
  { key: 'other', labelKey: 'community.queries.categoryOther' },
];

export default function QueriesPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data, loading, error, reload } = useCommunityData<Query[]>('/community/queries');
  const canManageStatus = me?.memberships?.[0]?.role !== 'member';
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'committee' | 'helpdesk'>('committee');
  const [category, setCategory] = useState<HelpdeskCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<HelpdeskCategory | ''>('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/queries', {
        type,
        category: type === 'helpdesk' && category ? category : undefined,
        subject,
        body,
      });
      setSubject('');
      setBody('');
      setCategory('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.queries.couldNotSubmit'));
    } finally {
      setBusy(false);
    }
  }

  const visibleQueries = (data ?? []).filter(
    (q) => !categoryFilter || (q.type === 'helpdesk' && q.category === categoryFilter),
  );

  return (
    <CommunityPageFrame
      title={t('community.queries.title')}
      subtitle={t('community.queries.subtitle')}
      action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.queries.raiseQuery')}</Button>}
      loading={loading}
      error={error}
      isEmpty={!showForm && visibleQueries.length === 0}
      emptyMessage={t('community.queries.noQueries')}
    >
      <div className="flex flex-col gap-4">
        {canManageStatus && (data ?? []).some((q) => q.type === 'helpdesk') && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={categoryFilter === '' ? 'primary' : 'outline'} onClick={() => setCategoryFilter('')}>
              {t('common.all')}
            </Button>
            {HELPDESK_CATEGORIES.map((c) => (
              <Button
                key={c.key}
                size="sm"
                variant={categoryFilter === c.key ? 'primary' : 'outline'}
                onClick={() => setCategoryFilter(categoryFilter === c.key ? '' : c.key)}
              >
                {t(c.labelKey)}
              </Button>
            ))}
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{t('community.queries.whoFor')}</Label>
                  <div className="flex h-12 items-center rounded-xl bg-primary-50 p-1">
                    {([
                      ['committee', t('community.queries.managementCommittee')],
                      ['helpdesk', t('community.queries.helpDesk')],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={cn(
                          'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
                          type === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {type === 'helpdesk' && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="hd-category">{t('community.queries.categoryOptional')}</Label>
                    <select
                      id="hd-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as HelpdeskCategory | '')}
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    >
                      <option value="">{t('community.queries.chooseCategory')}</option>
                      {HELPDESK_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>{t(c.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subject">{t('community.queries.subject')}</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="body">{t('community.queries.details')}</Label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    className="rounded-xl border border-border bg-surface p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !subject.trim() || !body.trim()}>
                  {busy ? t('community.queries.submitting') : t('community.queries.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {visibleQueries.map((q) => (
          <QueryThread key={q.id} query={q} canManageStatus={canManageStatus} onUpdated={reload} />
        ))}
      </div>
    </CommunityPageFrame>
  );
}
