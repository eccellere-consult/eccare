import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { getPrimaryNeighborhoodId } from '@/lib/community-access';
import { ContactsTabs } from './contacts-tabs';

export const dynamic = 'force-dynamic';

export default async function ElderContactsPage() {
  const session = await getServerSession();

  const [contacts, inCommunity] = session
    ? await Promise.all([
        prisma.emergencyContact.findMany({
          where: { userId: session.userId },
          orderBy: { callOrder: 'asc' },
        }),
        getPrimaryNeighborhoodId(session.userId).then(Boolean),
      ])
    : [[], false];

  return (
    <ContactsTabs
      elderUserId={session?.userId ?? ''}
      initialEmergencyContacts={contacts}
      inCommunity={inCommunity}
    />
  );
}
