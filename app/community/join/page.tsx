'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { CommunityJoinFields, useJoinFields, type CommunityOption } from '@/components/community/join-fields';
import { TourButton } from '@/components/tour/TourButton';
import { communityApi } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

/** Joining a community, made for one tap at a time: pick your community from a list (or search it),
 *  type just your house number or name — it follows the community's usual block for you — and tap once
 *  to save where your house is. (New accounts do the same in the last step of registering.) */
export default function JoinCommunityPage() {
  const router = useRouter();
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const fill = (key: TranslationKey, values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
  const homePath = lang ? '/elder' : '/family';

  const [welcome, setWelcome] = useState(false);
  const f = useJoinFields((q) => communityApi.get<CommunityOption[]>(`/community/join-options?q=${encodeURIComponent(q)}`));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ name: string; pending: boolean } | null>(null);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
  }, []);

  async function submit() {
    setError('');
    if (!f.target) {
      setError(t('community.join.chooseFirst'));
      return;
    }
    if (!f.houseCheck || !f.houseCheck.ok) {
      setError(f.house.trim() && f.houseCheck && !f.houseCheck.ok ? f.houseCheck.message : t('community.house.required'));
      return;
    }
    setBusy(true);
    try {
      const result = await communityApi.post<{ status: 'pending' | 'approved' | 'rejected'; neighborhood: { name: string } }>('/community/join', {
        ...f.target,
        flatNumber: f.houseCheck.value,
        ...(f.location ? { lat: f.location.lat, lng: f.location.lng } : {}),
      });
      if (result.status === 'pending') {
        // Stay here with a confirmation instead of redirecting into a community the person
        // can't see yet (a pending request is refused by the community pages).
        setDone({ name: result.neighborhood.name, pending: true });
        return;
      }
      router.push('/community');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('community.join.couldNotJoin'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <CommunityPageFrame title={t('community.join.title')}>
        <Card className="max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
              <Check className="h-9 w-9 text-success-600" />
            </span>
            <p className="text-lg font-bold text-text">{fill('community.join.requestSentNamed', { name: done.name })}</p>
            {f.location && (
              <p className="flex items-center gap-2 text-sm font-semibold text-success-600">
                <Check className="h-4 w-4" /> {t('community.join.locationSaved')}
              </p>
            )}
            <Button size="lg" className="mt-2 w-full" onClick={() => router.push(homePath)}>
              {t('nav.home')}
            </Button>
          </CardContent>
        </Card>
      </CommunityPageFrame>
    );
  }

  return (
    <CommunityPageFrame title={t('community.join.title')} subtitle={t('community.join.subtitle')}>
      <div className="flex max-w-lg flex-col gap-4">
        {welcome && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent-100 bg-accent-50 p-4">
            <p className="text-base font-bold text-accent-900">{t('community.join.welcome')}</p>
            <button type="button" onClick={() => router.push(homePath)} className="self-start text-sm font-semibold text-accent-900 underline">
              {t('community.join.skipForNow')}
            </button>
          </div>
        )}

        <CommunityJoinFields f={f} t={t} fill={fill} />

        {f.target && (
          <>
            {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
            <Button type="button" size="lg" disabled={busy || !f.ready} onClick={submit} className="h-auto min-h-14 w-full whitespace-normal py-3">
              {busy ? t('community.join.joining') : f.selected ? fill('community.join.joinNamed', { name: f.selected.name }) : t('community.join.joinCommunity')}
            </Button>
          </>
        )}

        <TourButton tourId="joinCommunity" />

        <p className="text-sm text-text-secondary">
          {t('community.join.noCodeYet')}{' '}
          <Link href="/community-registration" className="font-semibold text-primary-600 hover:underline">
            {t('community.join.registerYourCommunity')}
          </Link>
        </p>
      </div>
    </CommunityPageFrame>
  );
}
