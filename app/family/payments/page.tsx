import Link from 'next/link';
import { IndianRupee } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FamilyPaymentsPicker() {
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
      <h1 className="text-2xl font-bold text-text">Payments</h1>
      <p className="mt-1 text-text-secondary">Choose an elder to view or pay association fees.</p>

      {relations.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <IndianRupee className="h-8 w-8 text-primary-600" />
            </div>
            <p className="text-lg font-bold text-text">No elder connections</p>
            <p className="text-text-secondary">You need an accepted elder connection to view or pay fees.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {relations.map((rel) => (
            <Link key={rel.id} href={`/family/payments/${rel.elderUser.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <IndianRupee className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-text">{rel.elderUser.name}</p>
                    <p className="text-sm text-text-secondary">{rel.elderUser.phone}</p>
                  </div>
                  {rel.relationship && (
                    <Badge variant="muted" className="ml-auto">{rel.relationship}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
