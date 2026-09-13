import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { SosEventsList } from '@/components/sos-events-list';

export const dynamic = 'force-dynamic';

/** GET /api/v1/emergency/sos already defaults to the caller when no
 *  elderUserId is given — this page just needed to exist and be linked from
 *  somewhere (app/elder/profile/page.tsx), it needed no backend change. */
export default async function ElderSosHistoryPage() {
  const user = await getServerUser();
  if (!user) return null;

  const events = await prisma.sOSEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">My SOS history</h1>
      <p className="mt-1 text-text-secondary">Your past emergency alerts.</p>
      <SosEventsList events={events} />
    </div>
  );
}
