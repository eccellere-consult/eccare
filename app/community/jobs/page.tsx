'use client';

import { useEffect, useState } from 'react';
import { Phone, Clock, Briefcase, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Posting {
  id: string;
  postingType: 'job_offered' | 'job_wanted' | 'resource_offered' | 'resource_wanted';
  title: string;
  description: string | null;
  compensation: string | null;
  contactPhone: string;
  houseNumber: string | null;
  preferredContactTime: string | null;
  status: 'active' | 'closed';
  postedBy: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

const TABS: { key: Posting['postingType']; labelKey: TranslationKey }[] = [
  { key: 'job_offered', labelKey: 'community.jobs.tabJobsOffered' },
  { key: 'job_wanted', labelKey: 'community.jobs.tabJobsWanted' },
  { key: 'resource_offered', labelKey: 'community.jobs.tabResourcesOffered' },
  { key: 'resource_wanted', labelKey: 'community.jobs.tabResourcesWanted' },
];

const EMPTY_FORM = {
  postingType: 'job_offered' as Posting['postingType'],
  title: '',
  description: '',
  compensation: '',
  contactPhone: '',
  houseNumber: '',
  preferredContactTime: '',
};

export default function JobsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, reload } = useCommunityData<Posting[]>('/community/jobs');
  const { data: me } = useCommunityData<Me>('/community/me');
  const myUserRole = me?.memberships?.[0]?.role;
  const canManageAny = myUserRole === 'committee' || myUserRole === 'admin';
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMyUserId(j.data.id); })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<Posting['postingType']>('job_offered');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const filtered = (data ?? []).filter((p) => p.postingType === activeTab);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/jobs', {
        postingType: form.postingType,
        title: form.title,
        description: form.description || undefined,
        compensation: form.compensation || undefined,
        contactPhone: form.contactPhone,
        houseNumber: form.houseNumber || undefined,
        preferredContactTime: form.preferredContactTime || undefined,
      });
      setForm({ ...EMPTY_FORM, postingType: activeTab });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.jobs.couldNotPost'));
    } finally {
      setBusy(false);
    }
  }

  async function close(id: string) {
    setActionId(id);
    try {
      await communityApi.patch(`/community/jobs/${id}`, { status: 'closed' });
      reload();
    } finally {
      setActionId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm(t('community.jobs.confirmRemove'))) return;
    setActionId(id);
    try {
      await communityApi.delete(`/community/jobs/${id}`);
      reload();
    } finally {
      setActionId(null);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.jobs.title')}
      subtitle={t('community.jobs.subtitle')}
      action={<Button onClick={() => { setForm({ ...EMPTY_FORM, postingType: activeTab }); setShowForm((s) => !s); }}>{showForm ? t('common.cancel') : t('community.jobs.post')}</Button>}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={activeTab === tab.key ? 'primary' : 'outline'}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </Button>
          ))}
        </div>

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="jp-type">{t('community.jobs.postingType')}</Label>
                  <select
                    id="jp-type"
                    value={form.postingType}
                    onChange={(e) => setForm((f) => ({ ...f, postingType: e.target.value as Posting['postingType'] }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {TABS.map((tab) => (
                      <option key={tab.key} value={tab.key}>{t(tab.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="jp-title">{t('community.jobs.titleLabel')}</Label>
                  <Input id="jp-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('community.jobs.titlePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="jp-desc">{t('community.jobs.descriptionOptional')}</Label>
                  <Input id="jp-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t('community.jobs.descriptionPlaceholder')} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jp-comp">{t('community.jobs.compensationOptional')}</Label>
                    <Input id="jp-comp" value={form.compensation} onChange={(e) => setForm((f) => ({ ...f, compensation: e.target.value }))} placeholder={t('community.jobs.compensationPlaceholder')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jp-phone">{t('community.jobs.contactNumber')}</Label>
                    <Input id="jp-phone" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="9876543210" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jp-time">{t('community.jobs.preferredTimeOptional')}</Label>
                    <Input id="jp-time" value={form.preferredContactTime} onChange={(e) => setForm((f) => ({ ...f, preferredContactTime: e.target.value }))} placeholder={t('community.jobs.preferredTimePlaceholder')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jp-house">{t('community.jobs.houseNumberOptional')}</Label>
                    <Input id="jp-house" value={form.houseNumber} onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))} placeholder={t('community.jobs.houseNumberPlaceholder')} />
                  </div>
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.title || !form.contactPhone} className="self-start">
                  {busy ? t('community.jobs.posting') : t('community.jobs.post')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              {t('community.jobs.nothingPosted')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((p) => {
              const isOwner = p.postedBy.id === myUserId;
              return (
                <Card key={p.id}>
                  <CardContent className="flex gap-4 pt-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Briefcase className="h-5 w-5 text-primary-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-text">{p.title}</p>
                        {p.status === 'closed' && <Badge variant="muted">{t('community.jobs.closed')}</Badge>}
                      </div>
                      {p.compensation && <p className="text-sm font-semibold text-primary-900">{p.compensation}</p>}
                      {p.description && <p className="mt-1 text-sm text-text-secondary">{p.description}</p>}
                      <p className="mt-1 text-xs text-text-secondary">{t('community.jobs.postedBy').replace('{name}', p.postedBy.name)}</p>
                      {p.houseNumber && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                          <Home className="h-3.5 w-3.5" />
                          {t('community.jobs.house').replace('{number}', p.houseNumber)}
                        </p>
                      )}
                      {p.preferredContactTime && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                          <Clock className="h-3.5 w-3.5" />
                          {p.preferredContactTime}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`tel:${p.contactPhone}`}
                          className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {t('common.call')}
                        </a>
                        {isOwner && p.status === 'active' && (
                          <Button size="sm" variant="outline" disabled={actionId === p.id} onClick={() => close(p.id)}>
                            {t('community.jobs.markClosed')}
                          </Button>
                        )}
                        {(isOwner || canManageAny) && (
                          <Button size="sm" variant="outline" className="text-danger-600" disabled={actionId === p.id} onClick={() => remove(p.id)}>
                            {t('community.jobs.remove')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CommunityPageFrame>
  );
}
