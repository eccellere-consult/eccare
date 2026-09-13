import Link from 'next/link';
import { HeartPulse, User } from 'lucide-react';
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
      <p className="mt-1 text-text-secondary">Choose an elder to manage their health, or track your own.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/family/health/self">
          <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
                <User className="h-6 w-6 text-accent-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-text">Myself</p>
                <p className="text-sm text-text-secondary">Your own medicines, appointments, and notes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

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
    </div>
  );
}
