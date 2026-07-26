import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { ElderContactsClient } from './contacts-client';

export default async function ElderContactsPage() {
  const session = await getServerSession();

  const contacts = session
    ? await prisma.emergencyContact.findMany({
        where: { userId: session.userId },
        orderBy: { callOrder: 'asc' },
      })
    : [];

  return <ElderContactsClient initialContacts={contacts} />;
}
