'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  /** The block / association the community writes its houses with ("GRA"), set when it was registered. */
  housePrefix: string | null;
  /** Only known while signed in. */
  joined?: 'approved' | 'pending' | null;
  nearYou: boolean;
}

type T = (key: TranslationKey) => string;
type Fill = (key: TranslationKey, values: Record<string, string | number>) => string;

/** Everything a person decides to join a community: which one, their house, where it is. Shared by
 *  the join page (signed in) and the last step of creating an account, so both behave the same.
 *
 *  The house is two parts — the block / association and the number ("GRA" + "27" = GRA-27). When the
 *  community has a prefix it is filled in and fixed; otherwise the person types the block too. A house
 *  that has a name instead of a number can be entered as a name. */
export function useJoinFields(load: (query: string) => Promise<CommunityOption[]>) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CommunityOption[] | null>(null);
  const [selected, setSelected] = useState<CommunityOption | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [blockTyped, setBlockTyped] = useState('');
  const [numberTyped, setNumberTyped] = useState('');
  const [nameTyped, setNameTyped] = useState('');
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

  const fixedBlock = !useCode && selected?.housePrefix ? selected.housePrefix : null;
  const block = (fixedBlock ?? blockTyped).trim().toUpperCase();
  // "GRA-27" typed into the number box is the same as "27".
  const number = (block ? numberTyped.replace(new RegExp(`^${block}[\\s\\-/.]*`, 'i'), '') : numberTyped).trim().toUpperCase();
  const house = nameMode ? nameTyped.trim() : block && number ? `${block}-${number}` : '';
  const houseCheck = house ? normalizeHouseInput(house) : null;

  const target: { neighborhoodId: string } | { joinCode: string } | null =
    selected && !selected.joined ? { neighborhoodId: selected.id } : useCode && joinCode.trim().length >= 4 ? { joinCode: joinCode.trim() } : null;

  return {
    query, setQuery, options, selected, setSelected, useCode, setUseCode, joinCode, setJoinCode,
    fixedBlock, block, blockTyped, setBlockTyped, numberTyped, setNumberTyped, nameTyped, setNameTyped, nameMode, setNameMode,
    location, setLocation,
    house, houseCheck, target,
    ready: Boolean(target) && houseCheck?.ok === true,
  };
}
export type JoinFields = ReturnType<typeof useJoinFields>;

function StepTitle({ n, children, note }: { n: number; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{n}</span>
      <h2 className="min-w-0 text-base font-bold text-text">{children}</h2>
      {note && <span className="text-sm text-text-secondary">({note})</span>}
    </div>
  );
}

/** The three steps of joining: pick your community from a list (or search it), give your house as
 *  block + number, tap once to save where the house is. */
export function CommunityJoinFields({ f, t, fill }: { f: JoinFields; t: T; fill: Fill }) {
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const numberRef = useRef<HTMLInputElement | null>(null);

  function choose(option: CommunityOption) {
    f.setSelected(option);
    f.setBlockTyped('');
    f.setNumberTyped('');
    f.setNameTyped('');
    f.setNameMode(false);
    window.setTimeout(() => {
      stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      numberRef.current?.focus({ preventScroll: true });
    }, 80);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Which community */}
      <section aria-labelledby="join-step-1">
        <StepTitle n={1}>
          <span id="join-step-1">{t('community.join.step1')}</span>
        </StepTitle>

        {f.selected ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary-600 bg-primary-50 p-3">
            <Building2 className="h-6 w-6 shrink-0 text-primary-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-text">{f.selected.name}</p>
              <p className="truncate text-sm text-text-secondary">{[f.selected.city, f.selected.pincode].filter(Boolean).join(' · ')}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => f.setSelected(null)}>
              {t('community.join.change')}
            </Button>
          </div>
        ) : f.useCode ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="joinCode">{t('community.join.communityCode')}</Label>
            <Input
              id="joinCode"
              value={f.joinCode}
              onChange={(e) => f.setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              className="uppercase tracking-widest"
            />
            <button type="button" onClick={() => f.setUseCode(false)} className="self-start text-sm font-semibold text-primary-600 hover:underline">
              {t('community.join.change')}
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
              <Input
                value={f.query}
                onChange={(e) => f.setQuery(e.target.value)}
                placeholder={t('community.join.searchPlaceholder')}
                aria-label={t('community.join.searchPlaceholder')}
                className="pl-10"
              />
            </div>

            <div role="radiogroup" aria-labelledby="join-step-1" className="mt-3 flex flex-col gap-2">
              {f.options === null && (
                <p className="flex items-center gap-2 py-3 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
                </p>
              )}
              {f.options?.length === 0 && <p className="py-2 text-sm text-text-secondary">{t('community.join.nothingFound')}</p>}
              {f.options?.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled={Boolean(o.joined)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors pointer-coarse:min-h-tap-coarse',
                    o.joined ? 'opacity-70' : 'hover:border-primary-600 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Building2 className="h-5 w-5 text-primary-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-text">{o.name}</span>
                    <span className="block text-sm text-text-secondary">{[o.city, o.pincode].filter(Boolean).join(' · ')}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-text-secondary">{fill('community.join.memberCount', { count: o.memberCount })}</span>
                      {o.nearYou && !o.joined && <span className="rounded-full bg-accent-50 px-2 py-0.5 font-bold text-accent-900">{t('community.join.nearYou')}</span>}
                      {o.joined && (
                        <span className="rounded-full bg-success-50 px-2 py-0.5 font-bold text-success-600">
                          {o.joined === 'approved' ? t('community.join.alreadyIn') : t('community.join.requestAlready')}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <button type="button" onClick={() => f.setUseCode(true)} className="mt-3 text-sm font-semibold text-primary-600 hover:underline">
              {t('community.join.haveCode')}
            </button>
          </>
        )}
      </section>

      {f.target && (
        <div ref={stepsRef} className="flex scroll-mt-4 flex-col gap-6">
          {/* 2. The house: block + number */}
          <section aria-labelledby="join-step-2">
            <StepTitle n={2}>
              <span id="join-step-2">{t('community.join.step2')}</span>
            </StepTitle>

            {f.nameMode ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="house-name">{t('community.house.houseName')}</Label>
                <Input
                  id="house-name"
                  ref={numberRef}
                  value={f.nameTyped}
                  onChange={(e) => f.setNameTyped(e.target.value.toUpperCase())}
                  placeholder={t('community.house.houseNamePlaceholder')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="uppercase"
                />
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="house-block">{t('community.house.block')}</Label>
                  <Input
                    id="house-block"
                    value={f.block}
                    onChange={(e) => f.setBlockTyped(e.target.value.toUpperCase())}
                    readOnly={Boolean(f.fixedBlock)}
                    placeholder={t('community.house.blockPlaceholder')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className={cn('uppercase', f.fixedBlock && 'cursor-default border-primary-300 bg-primary-50 font-semibold text-primary-900')}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="house-number">{t('community.house.number')}</Label>
                  <Input
                    id="house-number"
                    ref={numberRef}
                    value={f.numberTyped}
                    onChange={(e) => f.setNumberTyped(e.target.value.toUpperCase())}
                    placeholder={t('community.house.numberPlaceholder')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="uppercase"
                  />
                </div>
              </div>
            )}

            <button type="button" onClick={() => f.setNameMode(!f.nameMode)} className="mt-2 text-sm font-semibold text-primary-600 hover:underline">
              {f.nameMode ? t('community.house.useBlock') : t('community.house.useName')}
            </button>
            {f.houseCheck?.ok ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-success-600">
                <Check className="h-4 w-4" /> {fill('community.join.houseSavedAs', { house: f.houseCheck.value })}
              </p>
            ) : f.houseCheck ? (
              <p className="mt-2 text-sm text-danger-600">{f.houseCheck.message}</p>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">{t('community.house.helper')}</p>
            )}
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
