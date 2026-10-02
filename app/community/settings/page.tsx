'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Preference {
  key: string;
  label: string;
  description: string;
  push: boolean;
  email: boolean;
}

interface Membership {
  id: string;
  neighborhoodId: string;
  flatNumber: string | null;
  showInDirectory: boolean;
  neighborhood: { name: string };
}

interface Me {
  memberships: Membership[];
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors',
        checked ? 'justify-end bg-primary-600' : 'justify-start bg-border',
      )}
    >
      <span className="h-6 w-6 rounded-full bg-white shadow" />
    </button>
  );
}

function DirectoryVisibilitySection() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, setData } = useCommunityData<Me>('/community/me');
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(neighborhoodId: string, showInDirectory: boolean) {
    const previous = data;
    setData(
      (prev) =>
        prev && {
          ...prev,
          memberships: prev.memberships.map((m) =>
            m.neighborhoodId === neighborhoodId ? { ...m, showInDirectory } : m,
          ),
        },
    );
    setSaving(neighborhoodId);
    try {
      await communityApi.patch('/community/me', { neighborhoodId, showInDirectory });
    } catch {
      setData(previous ?? null);
    } finally {
      setSaving(null);
    }
  }

  if (loading || (data?.memberships.length ?? 0) === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
        {t('community.settings.neighboursDirectory')}
      </h2>
      {data?.memberships.map((m) => (
        <Card key={m.neighborhoodId}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text">
                {t('community.settings.showMeIn').replace(
                  '{name}',
                  data.memberships.length > 1 ? m.neighborhood.name : t('community.settings.yourNeighboursDirectory'),
                )}
              </p>
              <p className="text-sm text-text-secondary">
                {t('community.settings.directoryHelper')}
              </p>
            </div>
            <Toggle
              checked={m.showInDirectory}
              onChange={(v) => toggle(m.neighborhoodId, v)}
              label={`Show me in ${m.neighborhood.name}'s directory`}
            />
          </CardContent>
          {saving === m.neighborhoodId && <p className="px-6 pb-2 text-xs text-text-secondary">{t('community.settings.saving')}</p>}
        </Card>
      ))}
    </div>
  );
}

/** The resident's own house/flat number for each community they're in. The join
 *  form's field is optional, so plenty of members never set one — this is where
 *  they (or anyone who skipped it) can add it, and it's what the Local Directory
 *  shows next to their name. */
function HouseNumberSection() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading } = useCommunityData<Me>('/community/me');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (loading || (data?.memberships.length ?? 0) === 0) return null;

  async function save(m: Membership) {
    setSaving(m.neighborhoodId);
    setError('');
    try {
      await communityApi.patch('/community/me', {
        neighborhoodId: m.neighborhoodId,
        flatNumber: values[m.neighborhoodId] ?? m.flatNumber ?? '',
      });
      setSaved(m.neighborhoodId);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('community.settings.couldNotLeave'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      {data?.memberships.map((m) => (
        <Card key={m.neighborhoodId}>
          <CardContent className="flex flex-col gap-3 py-4">
            <div>
              <Label htmlFor={`house-${m.neighborhoodId}`} className="text-base font-bold text-text">
                {t('community.settings.houseNumber')}
                {data.memberships.length > 1 ? ` — ${m.neighborhood.name}` : ''}
              </Label>
              <p className="text-sm text-text-secondary">{t('community.settings.houseNumberHelper')}</p>
            </div>
            <div className="flex gap-2">
              <Input
                id={`house-${m.neighborhoodId}`}
                value={values[m.neighborhoodId] ?? m.flatNumber ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [m.neighborhoodId]: e.target.value }))}
                placeholder={t('community.settings.houseNumberPlaceholder')}
                maxLength={32}
              />
              <Button onClick={() => save(m)} disabled={saving === m.neighborhoodId}>
                {saving === m.neighborhoodId
                  ? t('community.settings.saving')
                  : saved === m.neighborhoodId
                    ? t('community.settings.houseNumberSaved')
                    : t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}

function LeaveCommunitySection() {
  const router = useRouter();
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading } = useCommunityData<Me>('/community/me');
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (loading || (data?.memberships.length ?? 0) === 0) return null;

  async function leave(m: Membership) {
    if (!confirm(t('community.settings.confirmLeave').replace('{name}', m.neighborhood.name))) return;
    setLeavingId(m.id);
    setError('');
    try {
      await communityApi.delete(`/community/members/${m.id}`);
      router.push('/community/join');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('community.settings.couldNotLeave'));
      setLeavingId(null);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
        {t('community.settings.leaveSection')}
      </h2>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {data?.memberships.map((m) => (
        <Card key={m.id} className="border-danger-100">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="font-semibold text-text">{m.neighborhood.name}</p>
            <Button
              variant="outline"
              size="sm"
              className="border-danger-600 text-danger-600"
              disabled={leavingId === m.id}
              onClick={() => leave(m)}
            >
              <LogOut className="h-4 w-4" />
              {leavingId === m.id ? t('community.settings.leaving') : t('community.settings.leaveCommunity')}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function NotificationSettingsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, setData } = useCommunityData<Preference[]>(
    '/notifications/preferences',
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function update(category: string, patch: { push?: boolean; email?: boolean }) {
    // Optimistic — a toggle that lags feels broken, and the failure path just reverts.
    const previous = data;
    setData((prev) =>
      (prev ?? []).map((p) => (p.key === category ? { ...p, ...patch } : p)),
    );
    setSaving(category);
    try {
      await communityApi.put('/notifications/preferences', { category, ...patch });
    } catch {
      setData(previous ?? null);
    } finally {
      setSaving(null);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.settings.title')}
      subtitle={t('community.settings.subtitle')}
      loading={loading}
      error={error}
    >
      <HouseNumberSection />
      <DirectoryVisibilitySection />
      <LeaveCommunitySection />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
        {t('community.settings.notifications')}
      </h2>
      <div className="flex flex-col gap-3">
        {data?.map((p) => (
          <Card key={p.key}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text">{p.label}</p>
                <p className="text-sm text-text-secondary">{p.description}</p>
              </div>
              <Toggle
                checked={p.push}
                onChange={(v) => update(p.key, { push: v })}
                label={`${p.label} notifications`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
