'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Member {
  id: string;
  role: 'member' | 'committee' | 'admin';
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
  viewerRole,
}: {
  neighborhoodId: string;
  viewerRole: 'committee' | 'admin';
}) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error, reload } = useCommunityData<Member[]>(
    `/community/members?neighborhoodId=${neighborhoodId}`,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

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
    if (!confirm(t('shared.communityMembers.confirmRemove').replace('{name}', member.user.name))) return;
    setBusyId(member.id);
    setActionError('');
    try {
      await communityApi.delete(`/community/members/${member.id}`);
      reload();
    } catch (err) {
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
  if ((data?.length ?? 0) === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-text-secondary">{t('shared.communityMembers.noMembersYet')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError && <p className="text-sm text-danger-600">{actionError}</p>}
      {data?.map((m) => (
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
              {m.role === 'member' && (
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === m.id}
                    onClick={() => setRole(m.id, 'member')}
                  >
                    {t('shared.communityMembers.removeFromCommittee')}
                  </Button>
                  {viewerRole === 'admin' && (
                    <Button size="sm" disabled={busyId === m.id} onClick={() => setRole(m.id, 'admin')}>
                      {t('shared.communityMembers.makeAdmin')}
                    </Button>
                  )}
                </>
              )}
              {m.role === 'admin' && viewerRole === 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => setRole(m.id, 'committee')}
                >
                  {t('shared.communityMembers.removeAdmin')}
                </Button>
              )}
              {/* Removing an admin outright (not just demoting) needs an admin-tier
                  viewer too — mirrors the DELETE route's own guard. */}
              {(m.role !== 'admin' || viewerRole === 'admin') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => removeMember(m)}
                  className="text-danger-600 hover:bg-danger-50"
                >
                  {t('shared.communityMembers.removeMember')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
