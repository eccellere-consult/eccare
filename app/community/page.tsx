import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { CommunityPageContent } from './community-page-content';

export const dynamic = 'force-dynamic';

/** Resolves elder/self for a caregiver (same pattern as app/family/contacts/page.tsx)
 *  and hands both to the client toggle. An elder viewing their own /community gets
 *  no elder relation at all, so the toggle never renders for them — CommunityHubClient
 *  behaves exactly as before. */
export default async function CommunityPage() {
  const user = await getServerUser();
  if (!user) return null;

  const relation =
    user.role === 'caregiver'
      ? await prisma.familyRelation.findFirst({
          where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
          include: { elderUser: true },
        })
      : null;

  return (
    <CommunityPageContent
      elder={relation ? { id: relation.elderUserId, name: relation.elderUser.name } : null}
      self={{ id: user.id, name: user.name }}
    />
  );
}
