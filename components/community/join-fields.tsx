'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LocationCapture, type CapturedLocation } from '@/components/community/location-capture';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { normalizeHouseInput } from '@/lib/house';
import { cn } from '@/lib/utils';

export interface CommunityOption {
  id: string;
  name: string;
  city: string | null;
  pincode: string | null;
  memberCount: number;
  housePrefix: string | null;
  /** Only known while signed in. */
  joined?: 'approved' | 'pending' | null;
  nearYou: boolean;
}

type T = (key: TranslationKey) => string;
type Fill = (key: TranslationKey, values: Record<string, string | number>) => string;

/** Everything a person decides to join a community: which one, their house, where it is. Shared by
 *  the join page (signed in) and the last step of creating an account, so both behave the same. */
export function useJoinFields(load: (query: string) => Promise<CommunityOption[]>) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CommunityOption[] | null>(null);
  const [selected, setSelected] = useState<CommunityOption | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [typed, setTyped] = useState('');
  const [nameMode, setNameMode] = useState(false);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Find communities as the person types (and show the nearest ones first when they have not).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadRef
        .current(query.trim())
        .then((rows) => {
          setOptions(rows);
          // Only one choice? Don't make anyone tap it.
          if (rows.length === 1 && !query.trim() && !rows[0].joined) setSelected((current) => current ?? rows[0]);
        })
        .catch(() => setOptions([]));
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [query]);

  // The community's usual block ("KGRA") is shown in front of the box, so only the number is typed.
  const prefix = !useCode && !nameMode && selected?.housePrefix ? selected.housePrefix : null;
  const typedClean = prefix ? typed.replace(new RegExp(`^${prefix}[\\s\\-/.]*`, 'i'), '') : typed;
  const house = prefix ? (typedClean.trim() ? `${prefix}-${typedClean.trim()}` : '') : typedClean;
  const houseCheck = house.trim() ? normalizeHouseInput(house, { defaultBlock: selected?.housePrefix ?? undefined }) : null;

  const target: { neighborhoodId: string } | { joinCode: string } | null =
    selected && !selected.joined ? { neighborhoodId: selected.id } : useCode && joinCode.trim().length >= 4 ? { joinCode: joinCode.trim() } : null;

  return {
    query, setQuery, options, selected, setSelected, useCode, setUseCode, joinCode, setJoinCode,
    typed, setTyped, nameMode, setNameMode, location, setLocation,
    prefix, house, houseCheck, target,
    ready: Boolean(target) && houseCheck?.ok === true,
  };
}
export type JoinFields = ReturnType<typeof useJoinFields>;

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

/** The three touch-friendly steps of joining: pick your community from a list (or search it), type
 *  just your house number or name after the community's usual block, tap once to save where the house is. */
export function CommunityJoinFields({ f, t, fill }: { f: JoinFields; t: T; fill: Fill }) {
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const houseRef = useRef<HTMLInputElement | null>(null);

  function choose(option: CommunityOption) {
    f.setSelected(option);
    f.setTyped('');
    f.setNameMode(false);
    window.setTimeout(() => {
      stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      houseRef.current?.focus({ preventScroll: true });
    }, 80);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Which community */}
      <section aria-labelledby="join-step-1">
        <StepTitle n={1}>
          <span id="join-step-1">{t('community.join.step1')}</span>
        </StepTitle>

        {f.selected ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-primary-600 bg-primary-50 p-4">
            <Building2 className="h-8 w-8 shrink-0 text-primary-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-text">{f.selected.name}</p>
              <p className="truncate text-sm text-text-secondary">{[f.selected.city, f.selected.pincode].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={() => f.setSelected(null)} className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2 text-base font-semibold text-primary-900">
              {t('community.join.change')}
            </button>
          </div>
        ) : f.useCode ? (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <label htmlFor="joinCode" className="text-base font-semibold text-text">{t('community.join.communityCode')}</label>
              <Input
                id="joinCode"
                value={f.joinCode}
                onChange={(e) => f.setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                className="h-14 text-xl tracking-widest"
              />
              <button type="button" onClick={() => f.setUseCode(false)} className="self-start text-base font-semibold text-primary-600 hover:underline">
                {t('community.join.change')}
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-text-secondary" />
              <Input
                value={f.query}
                onChange={(e) => f.setQuery(e.target.value)}
                placeholder={t('community.join.searchPlaceholder')}
                aria-label={t('community.join.searchPlaceholder')}
                className="h-14 pl-12 text-lg"
              />
            </div>

            <div role="radiogroup" aria-labelledby="join-step-1" className="mt-3 flex flex-col gap-3">
              {f.options === null && (
                <p className="flex items-center gap-2 py-4 text-base text-text-secondary">
                  <Loader2 className="h-5 w-5 animate-spin" /> {t('common.loading')}
                </p>
              )}
              {f.options?.length === 0 && <p className="py-2 text-base text-text-secondary">{t('community.join.nothingFound')}</p>}
              {f.options?.map((o) => (
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

            <button type="button" onClick={() => f.setUseCode(true)} className="mt-4 text-base font-semibold text-primary-600 hover:underline">
              {t('community.join.haveCode')}
            </button>
          </>
        )}
      </section>

      {f.target && (
        <div ref={stepsRef} className="flex flex-col gap-6 scroll-mt-4">
          {/* 2. The house */}
          <section aria-labelledby="join-step-2">
            <StepTitle n={2}>
              <span id="join-step-2">{t('community.join.step2')}</span>
            </StepTitle>
            <label htmlFor="house" className="mb-2 block text-base font-semibold text-text">
              {f.prefix ? t('community.house.number') : t('community.join.houseLabel')}
            </label>
            <div className="flex items-stretch gap-2">
              {f.prefix && (
                <span className="flex h-16 shrink-0 items-center rounded-xl border-2 border-primary-600 bg-primary-50 px-4 text-xl font-bold tracking-wide text-primary-900">
                  {f.prefix}-
                </span>
              )}
              <Input
                id="house"
                ref={houseRef}
                value={f.typed}
                onChange={(e) => f.setTyped(e.target.value.toUpperCase())}
                placeholder={f.prefix ? '27' : t('community.join.housePlaceholder')}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-16 min-w-0 flex-1 text-xl font-bold uppercase tracking-wide"
              />
            </div>
            {f.selected?.housePrefix && (
              <button type="button" onClick={() => { f.setNameMode(!f.nameMode); f.setTyped(''); }} className="mt-2 text-sm font-semibold text-primary-600 hover:underline">
                {f.nameMode ? t('community.house.useBlock') : t('community.house.useName')}
              </button>
            )}
            {f.houseCheck?.ok && (
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-success-600">
                <Check className="h-5 w-5" /> {fill('community.join.houseSavedAs', { house: f.houseCheck.value })}
              </p>
            )}
            {f.houseCheck && !f.houseCheck.ok && <p className="mt-2 text-base text-danger-600">{f.houseCheck.message}</p>}
          </section>

          {/* 3. Where the house is */}
          <section aria-labelledby="join-step-3">
            <StepTitle n={3} note={t('community.join.optional')}>
              <span id="join-step-3">{t('community.join.step3')}</span>
            </StepTitle>
            <LocationCapture
              value={f.location}
              onChange={f.setLocation}
              labels={{
                button: t('community.join.saveLocation'),
                help: t('community.join.locationHelp'),
                finding: t('community.join.locationFinding'),
                saved: t('community.join.locationSaved'),
                failed: t('community.join.locationFailed'),
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
