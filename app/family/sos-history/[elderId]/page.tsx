import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { SosEventsList } from '@/components/sos-events-list';

export const dynamic = 'force-dynamic';

/** `elderId` of literally "self" resolves to the caregiver's own id — same
 *  special-case string already used by app/family/health/[elderId]/page.tsx. */
export default async function FamilySosHistoryDetailPage({
  params,
}: {
  params: Promise<{ elderId: string }>;
}) {
  const { elderId: rawElderId } = await params;
  const session = await getServerSession();
  if (!session) return null;

  const isSelf = rawElderId === 'self';
  let targetUserId: string | null = null;
  let title = 'My SOS history';

  if (isSelf) {
    targetUserId = session.userId;
  } else {
    const relation = await prisma.familyRelation.findUnique({
      where: { elderUserId_caregiverUserId: { elderUserId: rawElderId, caregiverUserId: session.userId } },
      include: { elderUser: { select: { name: true } } },
    });
    if (!relation || relation.inviteStatus !== 'accepted') return null;
    targetUserId = relation.elderUserId;
    title = `${relation.elderUser.name}'s SOS history`;
  }

  const events = await prisma.sOSEvent.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div>
      <Link
        href="/family/sos-history"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" /> SOS history
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-text">{title}</h1>
      <SosEventsList events={events} />
    </div>
  );
}
