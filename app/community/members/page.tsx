'use client';

import { CommunityPageFrame } from '@/components/community/page-frame';
import { CommunityMembers } from '@/components/community-members';
import { useCommunityData } from '@/lib/community-client';

interface Me {
  memberships: { role: 'member' | 'committee' | 'admin'; neighborhood: { id: string } }[];
}

export default function CommunityMembersPage() {
  const { data, loading, error } = useCommunityData<Me>('/community/me');
  const membership = data?.memberships?.[0];

  const accessError = !membership
    ? "You haven't joined a community yet."
    : membership.role === 'member'
      ? 'Only the management committee can manage members.'
      : null;

  return (
    <CommunityPageFrame
      title="Manage members"
      subtitle="Promote a resident to committee, or grant admin."
      loading={loading}
      error={error ?? accessError}
    >
      {membership && membership.role !== 'member' && (
        <CommunityMembers neighborhoodId={membership.neighborhood.id} viewerRole={membership.role} />
      )}
    </CommunityPageFrame>
  );
}
