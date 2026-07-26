import { AlertTriangle, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminSosFeedPage() {
  const events = await prisma.sOSEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Platform SOS feed</h1>
      <p className="mt-1 text-text-secondary">All emergency alerts across EC, most recent first.</p>

      {events.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-12 text-center text-text-secondary">No SOS events yet.</CardContent>
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
                  <p className="font-semibold text-text">{event.user.name}</p>
                  <p className="text-sm text-text-secondary">
                    {event.user.phone} &middot; {event.createdAt.toLocaleString()}
                  </p>
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
