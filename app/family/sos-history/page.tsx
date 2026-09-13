import Link from 'next/link';
import { AlertTriangle, User } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/** Same "Myself" + per-elder tile pattern as app/family/health/page.tsx —
 *  a caregiver can now see their own self-triggered SOS events (from the
 *  emergency card on app/family/page.tsx) alongside each linked elder's,
 *  rather than only ever the first accepted elder's history. */
export default async function SosHistoryPicker() {
  const session = await getServerSession();
  const relations = session
    ? await prisma.familyRelation.findMany({
        where: { caregiverUserId: session.userId, inviteStatus: 'accepted' },
        include: { elderUser: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">SOS history</h1>
      <p className="mt-1 text-text-secondary">Choose whose emergency alerts to view.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/family/sos-history/self">
          <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
                <User className="h-6 w-6 text-accent-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-text">Myself</p>
                <p className="text-sm text-text-secondary">Your own emergency alerts</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {relations.map((rel) => (
          <Link key={rel.id} href={`/family/sos-history/${rel.elderUser.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <AlertTriangle className="h-6 w-6 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-text">{rel.elderUser.name}</p>
                  <p className="text-sm text-text-secondary">{rel.elderUser.phone}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
