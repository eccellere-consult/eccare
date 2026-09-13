import { AlertTriangle, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual SOS',
  ambulance: 'Ambulance called',
  police: 'Police called',
  community_panic: 'Community panic alert',
};

/** lat/lng come through as Prisma's Decimal type from a direct query but as
 *  plain numbers if ever passed through JSON — both have .toFixed(), which is
 *  all this component needs, so it accepts either rather than forcing a
 *  Decimal import here. */
interface SosEvent {
  id: string;
  triggerType: string;
  lat: { toFixed(digits: number): string } | null;
  lng: { toFixed(digits: number): string } | null;
  status: string;
  createdAt: Date;
}

/** Shared between app/elder/sos-history/page.tsx and
 *  app/family/sos-history/[elderId]/page.tsx — same event-card markup
 *  previously duplicated only in the family page (the elder had no SOS
 *  history page of its own until now). Plain presentational component, no
 *  client interactivity needed. */
export function SosEventsList({ events }: { events: SosEvent[] }) {
  if (events.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
            <AlertTriangle className="h-8 w-8 text-success-600" />
          </div>
          <CardTitle>All clear</CardTitle>
          <CardDescription>No emergency alerts have been triggered.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {events.map((event) => (
        <Card key={event.id}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-50">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-text">
                {TRIGGER_LABEL[event.triggerType] ?? event.triggerType}
              </p>
              <p className="text-sm text-text-secondary">{event.createdAt.toLocaleString()}</p>
              {event.lat != null && event.lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${event.lat.toFixed(6)},${event.lng.toFixed(6)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View location on map
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Badge variant={event.status === 'resolved' ? 'success' : 'danger'}>{event.status}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
