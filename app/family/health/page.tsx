import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FamilyHealthPicker() {
  const session = await getServerSession();
  const relations = session
    ? await prisma.familyRelation.findMany({
        where: {
          caregiverUserId: session.userId,
          inviteStatus: 'accepted',
          canViewHealth: true,
        },
        include: { elderUser: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Health management</h1>
      <p className="mt-1 text-text-secondary">Choose an elder to manage their health.</p>

      {relations.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <HeartPulse className="h-8 w-8 text-primary-600" />
            </div>
            <p className="text-lg font-bold text-text">No health access</p>
            <p className="text-text-secondary">
              You need an accepted elder connection with health viewing permission to manage their health here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {relations.map((rel) => (
            <Link key={rel.id} href={`/family/health/${rel.elderUser.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <HeartPulse className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-text">{rel.elderUser.name}</p>
                    <p className="text-sm text-text-secondary">{rel.elderUser.phone}</p>
                  </div>
                  <Badge variant="success" className="ml-auto">
                    {rel.canManageMeds ? 'Full access' : 'View only'}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
