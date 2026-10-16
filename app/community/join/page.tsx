'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Check, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { LocationCapture, type CapturedLocation } from '@/components/community/location-capture';
import { TourButton } from '@/components/tour/TourButton';
import { communityApi } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';
import { normalizeHouseInput } from '@/lib/house';
import { cn } from '@/lib/utils';

interface CommunityOption {
  id: string;
  name: string;
  city: string | null;
  pincode: string | null;
  description: string | null;
  memberCount: number;
  housePrefix: string | null;
  joined: 'approved' | 'pending' | null;
  nearYou: boolean;
}

function StepTitle({ n, children, note }: { n: number; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">{n}</span>
        <h2 className="min-w-0 text-xl font-bold text-text">{children}</h2>
      </div>
      {note && <p className="mt-1 pl-12 text-sm font-semibold text-text-secondary">({note})</p>}
    </div>
  );
}

/** Joining a community, made for one tap at a time: pick your community from a list (or search it),
 *  type just your house number or name — it is put into capitals and given the community's usual
 *  prefix for you — and tap once to save where your house is. */
export default function JoinCommunityPage() {
  const router = useRouter();
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const fill = (key: TranslationKey, values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
  const homePath = lang ? '/elder' : '/family';

  const [welcome, setWelcome] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CommunityOption[] | null>(null);
  const [selected, setSelected] = useState<CommunityOption | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [house, setHouse] = useState('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ name: string; pending: boolean } | null>(null);
  const stepsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
  }, []);

  // Find communities as the person types (and show the nearest ones first when they have not).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      communityApi
        .get<CommunityOption[]>(`/community/join-options?q=${encodeURIComponent(query.trim())}`)
        .then((rows) => {
          setOptions(rows);
          // Only one choice? Don't make anyone tap it.
          if (rows.length === 1 && !query.trim() && !rows[0].joined) setSelected((current) => current ?? rows[0]);
        })
        .catch(() => setOptions([]));
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [query]);

  function choose(option: CommunityOption) {
    setSelected(option);
    setError('');
    window.setTimeout(() => stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  const houseCheck = house.trim() ? normalizeHouseInput(house, { defaultBlock: selected?.housePrefix ?? undefined }) : null;
  const ready = Boolean((selected && !selected.joined) || (useCode && joinCode.trim().length >= 4)) && houseCheck?.ok === true;

  async function submit() {
    setError('');
    if (!selected && !(useCode && joinCode.trim().length >= 4)) {
      setError(t('community.join.chooseFirst'));
      return;
    }
    if (!houseCheck || !houseCheck.ok) {
      setError(house.trim() && houseCheck && !houseCheck.ok ? houseCheck.message : t('community.house.required'));
      return;
    }
    setBusy(true);
    try {
      const result = await communityApi.post<{ status: 'pending' | 'approved' | 'rejected'; neighborhood: { name: string } }>('/community/join', {
        ...(selected ? { neighborhoodId: selected.id } : { joinCode: joinCode.trim() }),
        flatNumber: houseCheck.value,
        ...(location ? { lat: location.lat, lng: location.lng } : {}),
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
            <p className="text-xl font-bold text-text">{fill('community.join.requestSentNamed', { name: done.name })}</p>
            {location && (
              <p className="flex items-center gap-2 text-base font-semibold text-success-600">
                <Check className="h-5 w-5" /> {t('community.join.locationSaved')}
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
          <div className="flex flex-col gap-2 rounded-2xl border border-accent-100 bg-accent-50 p-4">
            <p className="text-lg font-bold text-accent-900">{t('community.join.welcome')}</p>
            <button type="button" onClick={() => router.push(homePath)} className="self-start text-base font-semibold text-accent-900 underline">
              {t('community.join.skipForNow')}
            </button>
          </div>
        )}
        {/* 1. Which community */}
        <section aria-labelledby="join-step-1">
          <StepTitle n={1}>
            <span id="join-step-1">{t('community.join.step1')}</span>
          </StepTitle>

          {selected ? (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-primary-600 bg-primary-50 p-4">
              <Building2 className="h-8 w-8 shrink-0 text-primary-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-text">{selected.name}</p>
                <p className="truncate text-sm text-text-secondary">{[selected.city, selected.pincode].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2 text-base font-semibold text-primary-900">
                {t('community.join.change')}
              </button>
            </div>
          ) : useCode ? (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <label htmlFor="joinCode" className="text-base font-semibold text-text">{t('community.join.communityCode')}</label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  className="h-14 text-xl tracking-widest"
                />
                <button type="button" onClick={() => setUseCode(false)} className="self-start text-base font-semibold text-primary-600 hover:underline">
                  {t('community.join.change')}
                </button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-text-secondary" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('community.join.searchPlaceholder')}
                  aria-label={t('community.join.searchPlaceholder')}
                  className="h-14 pl-12 text-lg"
                />
              </div>

              <div role="radiogroup" aria-labelledby="join-step-1" className="mt-3 flex flex-col gap-3">
                {options === null && (
                  <p className="flex items-center gap-2 py-4 text-base text-text-secondary">
                    <Loader2 className="h-5 w-5 animate-spin" /> {t('common.loading')}
                  </p>
                )}
                {options?.length === 0 && <p className="py-2 text-base text-text-secondary">{t('community.join.nothingFound')}</p>}
                {options?.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={false}
                    disabled={Boolean(o.joined)}
                    onClick={() => choose(o)}
                    className={cn(
                      'flex min-h-20 items-center gap-4 rounded-2xl border-2 border-border bg-surface p-4 text-left transition-colors',
                      o.joined ? 'opacity-70' : 'hover:border-primary-600 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600',
                    )}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Building2 className="h-7 w-7 text-primary-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold text-text">{o.name}</span>
                      <span className="block text-sm text-text-secondary">{[o.city, o.pincode].filter(Boolean).join(' · ')}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-text-secondary">{fill('community.join.memberCount', { count: o.memberCount })}</span>
                        {o.nearYou && !o.joined && <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-bold text-accent-900">{t('community.join.nearYou')}</span>}
                        {o.joined && (
                          <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-bold text-success-600">
                            {o.joined === 'approved' ? t('community.join.alreadyIn') : t('community.join.requestAlready')}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => setUseCode(true)} className="mt-4 text-base font-semibold text-primary-600 hover:underline">
                {t('community.join.haveCode')}
              </button>
            </>
          )}
        </section>

        {(selected || (useCode && joinCode.trim().length >= 4)) && (
          <div ref={stepsRef} className="flex flex-col gap-6 scroll-mt-4">
            {/* 2. The house */}
            <section aria-labelledby="join-step-2">
              <StepTitle n={2}>
                <span id="join-step-2">{t('community.join.step2')}</span>
              </StepTitle>
              <label htmlFor="house" className="mb-2 block text-base font-semibold text-text">{t('community.join.houseLabel')}</label>
              <Input
                id="house"
                value={house}
                onChange={(e) => setHouse(e.target.value.toUpperCase())}
                placeholder={selected?.housePrefix ? `${selected.housePrefix}-27` : '27'}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-16 text-xl font-bold uppercase tracking-wide"
              />
              <p className="mt-2 text-sm text-text-secondary">{t('community.join.housePlaceholder')}</p>
              {houseCheck?.ok && (
                <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-success-600">
                  <Check className="h-5 w-5" /> {fill('community.join.houseSavedAs', { house: houseCheck.value })}
                </p>
              )}
              {houseCheck && !houseCheck.ok && <p className="mt-2 text-base text-danger-600">{houseCheck.message}</p>}
            </section>

            {/* 3. Where the house is */}
            <section aria-labelledby="join-step-3">
              <StepTitle n={3} note={t('community.join.optional')}>
                <span id="join-step-3">{t('community.join.step3')}</span>
              </StepTitle>
              <LocationCapture
                value={location}
                onChange={setLocation}
                labels={{
                  button: t('community.join.saveLocation'),
                  help: t('community.join.locationHelp'),
                  finding: t('community.join.locationFinding'),
                  saved: t('community.join.locationSaved'),
                  failed: t('community.join.locationFailed'),
                }}
              />
            </section>

            {error && <p role="alert" className="text-lg font-semibold text-danger-600">{error}</p>}

            <Button type="button" size="lg" disabled={busy || !ready} onClick={submit} className="h-auto min-h-16 w-full whitespace-normal py-3 text-xl leading-snug">
              {busy ? t('community.join.joining') : selected ? fill('community.join.joinNamed', { name: selected.name }) : t('community.join.joinCommunity')}
            </Button>
          </div>
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
