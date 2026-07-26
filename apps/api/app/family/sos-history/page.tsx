import Link from 'next/link';
import { AlertTriangle, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function SosHistoryPage() {
  const session = await getServerSession();

  const relation = session
    ? await prisma.familyRelation.findFirst({
        where: { caregiverUserId: session.userId, inviteStatus: 'accepted' },
        include: { elderUser: true },
      })
    : null;

  const events = relation
    ? await prisma.sOSEvent.findMany({
        where: { userId: relation.elderUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">SOS history</h1>
      <p className="mt-1 text-text-secondary">
        {relation ? `Emergency alerts from ${relation.elderUser.name}.` : 'Emergency alerts from your linked elder.'}
      </p>

      {!relation ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CardTitle>No elder connected yet</CardTitle>
            <CardDescription>Invite an elder to start seeing their SOS history here.</CardDescription>
            <Button asChild className="mt-2">
              <Link href="/family/invite">Invite an elder</Link>
            </Button>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
              <AlertTriangle className="h-8 w-8 text-success-600" />
            </div>
            <CardTitle>All clear</CardTitle>
            <CardDescription>No emergency alerts have been triggered.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-50">
                  <AlertTriangle className="h-5 w-5 text-danger-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text">
                    {event.triggerType === 'manual' ? 'Manual SOS' : event.triggerType}
                  </p>
                  <p className="text-sm text-text-secondary">{event.createdAt.toLocaleString()}</p>
                  {event.lat && event.lng && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
                    </p>
                  )}
                </div>
                <Badge variant={event.status === 'resolved' ? 'success' : 'danger'}>{event.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
