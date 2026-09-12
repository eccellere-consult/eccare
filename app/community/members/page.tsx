'use client';

import { CommunityPageFrame } from '@/components/community/page-frame';
import { CommunityMembers } from '@/components/community-members';
import { useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Me {
  memberships: { role: 'member' | 'committee' | 'admin'; neighborhood: { id: string } }[];
}

export default function CommunityMembersPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading, error } = useCommunityData<Me>('/community/me');
  const membership = data?.memberships?.[0];

  const accessError = !membership
    ? t('community.members.notJoined')
    : membership.role === 'member'
      ? t('community.members.onlyCommittee')
      : null;

  return (
    <CommunityPageFrame
      title={t('community.members.title')}
      subtitle={t('community.members.subtitle')}
      loading={loading}
      error={error ?? accessError}
    >
      {membership && membership.role !== 'member' && (
        <CommunityMembers neighborhoodId={membership.neighborhood.id} viewerRole={membership.role} />
      )}
    </CommunityPageFrame>
  );
}
