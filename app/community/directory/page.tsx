'use client';

import { CommunityPageFrame } from '@/components/community/page-frame';
import { DirectoryList } from '@/components/community/directory-list';

export default function DirectoryPage() {
  return (
    <CommunityPageFrame
      title="Local Directory"
      subtitle="Say hello, call directly, or star a neighbour to keep them at the top."
    >
      <DirectoryList />
    </CommunityPageFrame>
  );
}
