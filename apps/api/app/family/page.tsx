import Link from 'next/link';
import { UserPlus, Phone, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function FamilyDashboard() {
  const session = await getServerSession();
  const relations = session
    ? await prisma.familyRelation.findMany({
        where: { caregiverUserId: session.userId },
        include: { elderUser: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Your family</h1>
          <p className="mt-1 text-text-secondary">Elders you're connected with on EC.</p>
        </div>
        <Button asChild>
          <Link href="/family/invite">
            <UserPlus className="h-5 w-5" />
            Invite an elder
          </Link>
        </Button>
      </div>

      {relations.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <UserPlus className="h-8 w-8 text-primary-600" />
            </div>
            <CardTitle>No elders linked yet</CardTitle>
            <CardDescription>Invite an elder by phone number to get started.</CardDescription>
            <Button asChild className="mt-2">
              <Link href="/family/invite">Invite an elder</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {relations.map((rel) => (
            <Card key={rel.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{rel.elderUser.name}</CardTitle>
                  <CardDescription>{rel.relationship}</CardDescription>
                </div>
                <Badge variant={rel.inviteStatus === 'accepted' ? 'success' : 'muted'}>
                  {rel.inviteStatus === 'accepted' ? 'Connected' : 'Pending'}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {rel.elderUser.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Invited {rel.createdAt.toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
