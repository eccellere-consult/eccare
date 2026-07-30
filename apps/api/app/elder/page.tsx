import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { ElderHomeClient } from './elder-home-client';

export const dynamic = 'force-dynamic';

export default async function ElderHome() {
  const session = await getServerSession();

  const [user, invites] = session
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId } }),
        prisma.familyRelation.findMany({
          where: { elderUserId: session.userId, inviteStatus: 'pending' },
          include: { caregiverUser: true },
        }),
      ])
    : [null, []];

  return <ElderHomeClient userName={user?.name ?? 'there'} invites={invites} />;
}
