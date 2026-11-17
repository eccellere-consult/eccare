'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { DirectoryMatchReview } from '@/components/community/directory-match-review';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Member {
  id: string;
  role: 'member' | 'committee' | 'admin';
  flatNumber: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string | null };
  committeeTitle?: 'president' | 'secretary' | 'treasurer' | null;
  /** Set only while lent admin powers are still running. */
  adminDelegatedUntil?: string | null;
}

interface PowersInfo {
  committeeCanManageCommittee: boolean;
  committeeCanRemoveMembers: boolean;
  you: {
    userId: string;
    isAdmin: boolean;
    isActingAdmin: boolean;
    canManageCommittee: boolean;
    canRemoveMembers: boolean;
    canAdminister: boolean;
    delegatedUntil: string | null;
  };
}

const TITLE_OPTIONS = [
  { value: 'president', label: 'President' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
] as const;

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** yyyy-mm-dd in the viewer's own calendar, `days` from today. */
function dateInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-text">{label}</p>
        <p className="text-sm text-text-secondary">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-primary-600' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

interface PendingRequest {
  id: string;
  flatNumber: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string | null };
}

const ROLE_BADGE = { member: 'muted', committee: 'accent', admin: 'success' } as const;
const ROLE_LABEL_KEY: Record<Member['role'], TranslationKey> = {
  member: 'shared.communityMembers.role.member',
  committee: 'shared.communityMembers.role.committee',
  admin: 'shared.communityMembers.role.admin',
};

/**
 * Member list with role-change controls, shared between the resident-facing
 * `/community/members` page and the admin drill-in's Members tab. Granting or
 * removing admin status only shows for an admin-tier viewer — the API
 * enforces this too, these buttons are just kept from appearing for someone
 * who'd get a 403.
 */
export function CommunityMembers({
  neighborhoodId,
}: {
  neighborhoodId: string;
  /** Kept so existing callers still compile; what the viewer may do now comes from the server's rules. */
  viewerRole?: 'committee' | 'admin';
}) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, reload } = useCommunityData<Member[]>(
    `/community/members?neighborhoodId=${neighborhoodId}`,
  );
  const {
    data: pending,
    loading: pendingLoading,
    reload: reloadPending,
  } = useCommunityData<PendingRequest[]>(`/community/members?neighborhoodId=${neighborhoodId}&status=pending`);
  const { data: powerInfo, setData: setPowerInfo, reload: reloadPowers } = useCommunityData<PowersInfo>(
    `/community/committee-powers?neighborhoodId=${neighborhoodId}`,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [lendingId, setLendingId] = useState<string | null>(null);
  const [lendDate, setLendDate] = useState('');
  // Until the rules have loaded nothing risky is offered; the server checks every action anyway.
  const you = powerInfo?.you;
  const canManageCommittee = !!you?.canManageCommittee;
  const canRemoveMembers = !!you?.canRemoveMembers;
  const canAdminister = !!you?.canAdminister;

  async function saveSwitch(patch: Partial<Pick<PowersInfo, 'committeeCanManageCommittee' | 'committeeCanRemoveMembers'>>) {
    setActionError('');
    const before = powerInfo;
    setPowerInfo((p) => (p ? { ...p, ...patch } : p));
    try {
      await communityApi.patch(`/community/committee-powers?neighborhoodId=${neighborhoodId}`, patch);
      reloadPowers();
    } catch (err) {
      setPowerInfo(before);
      setActionError(err instanceof Error ? err.message : 'Could not save that. Please try again.');
    }
  }

  async function patchMember(member: Member, body: Record<string, unknown>, failMessage: string) {
    setBusyId(member.id);
    setActionError('');
    try {
      await communityApi.patch(`/community/members/${member.id}`, body);
      reload();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : failMessage);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function lendPowers(member: Member) {
    if (!lendDate) return;
    // Switches off at the end of the chosen day, in the admin's own time.
    const [y, m, d] = lendDate.split('-').map(Number);
    const end = new Date(y, m - 1, d, 23, 59, 0);
    if (await patchMember(member, { delegateAdminUntil: end.toISOString() }, 'Could not lend admin powers.')) {
      setLendingId(null);
      setLendDate('');
    }
  }

  async function decide(request: PendingRequest, action: 'approve' | 'reject') {
    setBusyId(request.id);
    setActionError('');
    try {
      await communityApi.patch(`/community/members/${request.id}`, { action });
      reloadPending();
      if (action === 'approve') reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t('shared.communityMembers.couldNotDecideRequest'),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(memberId: string, role: Member['role']) {
    setBusyId(memberId);
    setActionError('');
    try {
      await communityApi.patch(`/community/members/${memberId}`, { role });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('shared.communityMembers.couldNotUpdateRole'));
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(member: Member) {
    setBusyId(member.id);
    setActionError('');
    try {
      await communityApi.delete(`/community/members/${member.id}`);
      setConfirming(null);
      reload();
    } catch (err) {
      setConfirming(null);
      setActionError(err instanceof Error ? err.message : t('shared.communityMembers.couldNotRemove'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-text-secondary">{t('common.loading')}</p>;
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError && <p className="text-sm text-danger-600" role="alert">{actionError}</p>}

      {you?.isActingAdmin && you.delegatedUntil && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="py-3 text-sm text-text">
            <span className="font-bold">You are acting admin until {dayLabel(you.delegatedUntil)}.</span> The community
            admin has lent you their powers for now; they switch off by themselves on that date.
          </CardContent>
        </Card>
      )}

      {canAdminister && powerInfo && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
                What committee members may do
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Only you, as admin, can change these. Switched off, a committee member can still approve join requests
                and fix house numbers, but cannot change who is on the committee or remove anyone.
              </p>
            </div>
            <Switch
              label="Manage the committee"
              hint="Make residents committee members, take it away, and set President, Secretary or Treasurer."
              checked={powerInfo.committeeCanManageCommittee}
              onChange={(v) => saveSwitch({ committeeCanManageCommittee: v })}
            />
            <Switch
              label="Remove members"
              hint="Remove a resident from the community. They would need the join code to come back."
              checked={powerInfo.committeeCanRemoveMembers}
              onChange={(v) => saveSwitch({ committeeCanRemoveMembers: v })}
            />
          </CardContent>
        </Card>
      )}

      <DirectoryMatchReview neighborhoodId={neighborhoodId} />

      {!pendingLoading && (pending?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
            {t('shared.communityMembers.pendingRequests')}
          </h2>
          {pending!.map((p) => (
            <Card key={p.id} className="border-accent-100 bg-accent-50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-bold text-text">{p.user.name}</p>
                  <p className="text-sm text-text-secondary">
                    {p.user.phone ?? '—'}
                    {p.flatNumber ? ` · ${p.flatNumber}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busyId === p.id} onClick={() => decide(p, 'approve')}>
                    {t('shared.communityMembers.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === p.id}
                    onClick={() => decide(p, 'reject')}
                    className="text-danger-600 hover:bg-danger-50"
                  >
                    {t('shared.communityMembers.reject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-secondary">{t('shared.communityMembers.noMembersYet')}</CardContent>
        </Card>
      ) : (
        data?.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-bold text-text">{m.user.name}</p>
              <p className="text-sm text-text-secondary">
                {m.user.phone ?? '—'}
                {m.flatNumber ? ` · ${m.flatNumber}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ROLE_BADGE[m.role]}>{t(ROLE_LABEL_KEY[m.role])}</Badge>
              {m.committeeTitle && (
                <Badge variant="default">{TITLE_OPTIONS.find((o) => o.value === m.committeeTitle)?.label}</Badge>
              )}
              {m.adminDelegatedUntil && (
                <Badge variant="accent">Acting admin until {dayLabel(m.adminDelegatedUntil)}</Badge>
              )}

              {m.role !== 'member' && canManageCommittee && (
                <select
                  aria-label={`Title for ${m.user.name}`}
                  value={m.committeeTitle ?? ''}
                  disabled={busyId === m.id}
                  onChange={(e) =>
                    patchMember(m, { committeeTitle: e.target.value || null }, 'Could not set the title.')
                  }
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text"
                >
                  <option value="">No title</option>
                  {TITLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              {m.role === 'member' && canManageCommittee && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => setRole(m.id, 'committee')}
                >
                  {t('shared.communityMembers.makeCommittee')}
                </Button>
              )}
              {m.role === 'committee' && (
                <>
                  {canManageCommittee && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === m.id}
                      onClick={() => setRole(m.id, 'member')}
                    >
                      {t('shared.communityMembers.removeFromCommittee')}
                    </Button>
                  )}
                  {canAdminister && (
                    <Button size="sm" disabled={busyId === m.id} onClick={() => setRole(m.id, 'admin')}>
                      {t('shared.communityMembers.makeAdmin')}
                    </Button>
                  )}
                  {canAdminister && m.adminDelegatedUntil && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === m.id}
                      onClick={() => patchMember(m, { delegateAdminUntil: null }, 'Could not end it.')}
                    >
                      End admin powers now
                    </Button>
                  )}
                  {canAdminister && !m.adminDelegatedUntil && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === m.id}
                      onClick={() => {
                        setLendingId(lendingId === m.id ? null : m.id);
                        setLendDate('');
                      }}
                    >
                      Lend admin powers
                    </Button>
                  )}
                </>
              )}
              {m.role === 'admin' && canAdminister && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => setRole(m.id, 'committee')}
                >
                  {t('shared.communityMembers.removeAdmin')}
                </Button>
              )}
              {/* Removing someone is the easy mistake to make, so it only shows when the admin has
                  allowed it — mirrors the DELETE route's own guard, which still checks every time. */}
              {canRemoveMembers &&
                m.user.id !== you?.userId &&
                (m.role !== 'admin' || canAdminister) &&
                (m.role !== 'committee' || canManageCommittee) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === m.id}
                    onClick={() => setConfirming(m)}
                    className="text-danger-600 hover:bg-danger-50"
                  >
                    {t('shared.communityMembers.removeMember')}
                  </Button>
                )}
            </div>
            {lendingId === m.id && (
              <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-primary-50 p-3">
                <p className="text-sm text-text">
                  <span className="font-bold">{m.user.name}</span> will be able to do everything you can for the
                  people of this community — except change these switches, lend powers on, or touch the admin. It
                  switches off by itself at the end of the day you pick (up to 90 days).
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                    Until
                    <input
                      type="date"
                      value={lendDate}
                      min={dateInput(1)}
                      max={dateInput(89)}
                      onChange={(e) => setLendDate(e.target.value)}
                      className="h-11 rounded-lg border border-border bg-surface px-3 text-text"
                    />
                  </label>
                  <Button size="sm" disabled={!lendDate || busyId === m.id} onClick={() => lendPowers(m)}>
                    Lend until this date
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLendingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        ))
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-title"
          onClick={() => busyId === null && setConfirming(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="remove-title" className="text-lg font-bold text-text">
              Remove {confirming.user.name}?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {confirming.flatNumber ? `${confirming.user.name} of ${confirming.flatNumber} ` : `${confirming.user.name} `}
              will leave this community and will need the join code to come back. Their account is not deleted.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                disabled={busyId === confirming.id}
                onClick={() => removeMember(confirming)}
                className="bg-danger-600 text-white hover:bg-danger-900"
              >
                {busyId === confirming.id ? 'Removing…' : 'Yes, remove'}
              </Button>
              <Button variant="outline" disabled={busyId === confirming.id} onClick={() => setConfirming(null)}>
                Keep them
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
