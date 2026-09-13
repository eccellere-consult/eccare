import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { OrdersTabs } from './orders-tabs';

export const dynamic = 'force-dynamic';

/** Same "For [Elder] / For myself" pattern as app/family/contacts/page.tsx —
 *  GET /api/v1/orders already defaults to the caller's own id and
 *  canAccessElder(callerId, callerId) already returns true, so this needed
 *  no backend change, just resolving both identities and letting the
 *  caregiver pick. */
export default async function FamilyOrdersPage() {
  const user = await getServerUser();
  if (!user) return null;

  const relation = await prisma.familyRelation.findFirst({
    where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
    include: { elderUser: true },
  });

  return (
    <OrdersTabs
      elder={relation ? { id: relation.elderUserId, name: relation.elderUser.name } : null}
      self={{ id: user.id, name: user.name }}
    />
  );
}
