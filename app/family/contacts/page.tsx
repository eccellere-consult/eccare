import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { getPrimaryNeighborhoodId } from '@/lib/community-access';
import { ContactsTabs } from './contacts-tabs';

export const dynamic = 'force-dynamic';

/** A caregiver's own emergency/all contacts are already fully supported by the
 *  underlying routes (canAccessElder(callerId, callerId) is true, and
 *  EmergencyContact/Contact are keyed by a generic userId) — this page just
 *  needs to stop dead-ending when there's no elder yet, and let the caregiver
 *  pick "for myself" instead of only ever showing the first linked elder. */
export default async function FamilyContactsPage() {
  const user = await getServerUser();
  if (!user) return null;

  const relation = await prisma.familyRelation.findFirst({
    where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
    include: { elderUser: true },
  });

  const [elderInCommunity, selfInCommunity] = await Promise.all([
    relation ? getPrimaryNeighborhoodId(relation.elderUserId).then(Boolean) : Promise.resolve(false),
    getPrimaryNeighborhoodId(user.id).then(Boolean),
  ]);

  return (
    <ContactsTabs
      elder={
        relation
          ? { id: relation.elderUserId, name: relation.elderUser.name, inCommunity: elderInCommunity }
          : null
      }
      self={{ id: user.id, name: user.name, inCommunity: selfInCommunity }}
    />
  );
}
