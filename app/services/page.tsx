import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { ServicesClient } from './services-client';

export const dynamic = 'force-dynamic';

/** Same "For [Elder] / For myself" pattern as app/family/contacts/page.tsx,
 *  shown only for caregivers (an elder viewing their own Services page has
 *  nothing to toggle). Advisory, Bill Pay, and Property Management already
 *  accept an elderUserId param server-side and already default to the
 *  caller's own id — this just needed the UI to actually send one. */
export default async function ServicesPage() {
  const user = await getServerUser();

  const relation =
    user?.role === 'caregiver'
      ? await prisma.familyRelation.findFirst({
          where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
          include: { elderUser: true },
        })
      : null;

  return (
    <ServicesClient
      role={user?.role ?? null}
      elder={relation ? { id: relation.elderUserId, name: relation.elderUser.name } : null}
      self={user ? { id: user.id, name: user.name } : null}
    />
  );
}
