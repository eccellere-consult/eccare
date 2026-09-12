'use client';

import { useState, useEffect, useCallback } from 'react';
import { HeartHandshake, Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { buildWaLink as waLink } from '@/lib/whatsapp';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Volunteer {
  id: string;
  availability: 'weekdays' | 'weekends' | 'always';
  assistanceTypes: string[];
  user: { id: string; name: string; phone: string | null };
}

const AVAILABILITY_OPTIONS = [
  { value: '', labelKey: 'community.volunteers.availabilityAny' },
  { value: 'weekdays', labelKey: 'community.volunteers.weekdays' },
  { value: 'weekends', labelKey: 'community.volunteers.weekends' },
  { value: 'always', labelKey: 'community.volunteers.always' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];
const ASSISTANCE_OPTIONS = [
  { value: '', labelKey: 'community.volunteers.assistanceAny' },
  { value: 'medical_runs', labelKey: 'community.volunteers.medicalRuns' },
  { value: 'companionship', labelKey: 'community.volunteers.companionship' },
  { value: 'errands', labelKey: 'community.volunteers.errands' },
  { value: 'tech_support', labelKey: 'community.volunteers.techSupport' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];
const ASSISTANCE_LABEL_KEY: Record<string, TranslationKey> = Object.fromEntries(ASSISTANCE_OPTIONS.map((o) => [o.value, o.labelKey]));
const AVAILABILITY_LABEL_KEY: Record<string, TranslationKey> = Object.fromEntries(AVAILABILITY_OPTIONS.map((o) => [o.value, o.labelKey]));

export default function VolunteersDirectoryPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [volunteers, setVolunteers] = useState<Volunteer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [assistanceType, setAssistanceType] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (availability) params.set('availability', availability);
    if (assistanceType) params.set('assistanceType', assistanceType);
    fetch(`/api/v1/community/volunteers?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setVolunteers(j.data); else throw new Error(j.error?.message); })
      .catch((err) => setError(err instanceof Error ? err.message : t('community.volunteers.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [search, availability, assistanceType]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce search-as-you-type
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <CommunityPageFrame
      title={t('community.volunteers.title')}
      subtitle={t('community.volunteers.subtitle')}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('community.volunteers.searchPlaceholder')} className="sm:max-w-xs" />
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAvailability(availability === opt.value ? '' : opt.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${availability === opt.value && opt.value ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ASSISTANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAssistanceType(assistanceType === opt.value ? '' : opt.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${assistanceType === opt.value && opt.value ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {volunteers?.map((v) => (
          <Card key={v.id}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <HeartHandshake className="h-5 w-5 text-primary-600" />
                </span>
                <p className="font-bold text-text">{v.user.name}</p>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                <strong className="text-text">{t('community.volunteers.available')}</strong> {t(AVAILABILITY_LABEL_KEY[v.availability])}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                <strong className="text-text">{t('community.volunteers.canHelpWith')}</strong> {v.assistanceTypes.map((a) => (ASSISTANCE_LABEL_KEY[a] ? t(ASSISTANCE_LABEL_KEY[a]) : a)).join(', ')}
              </p>
              {v.user.phone && (
                <div className="mt-3 flex gap-2">
                  <a href={`tel:${v.user.phone}`} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                    <Phone className="h-3.5 w-3.5" /> {t('common.call')}
                  </a>
                  <a href={waLink(v.user.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                    <MessageCircle className="h-3.5 w-3.5" /> {t('community.volunteers.whatsapp')}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && (!volunteers || volunteers.length === 0) && (
        <Card className="mt-4"><CardContent className="py-12 text-center text-text-secondary">{t('community.volunteers.noneMatch')}</CardContent></Card>
      )}
    </CommunityPageFrame>
  );
}
