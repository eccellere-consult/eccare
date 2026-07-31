import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MockFrame } from '../showcase-shell';

export function QueueMock({
  requests,
}: {
  requests: { title: string; detail: string; eta: string; status: string }[];
}) {
  return (
    <MockFrame>
      <div className="flex flex-col gap-4">
        {requests.map((r) => (
          <div key={r.title} className="rounded-2xl border border-border bg-bg p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-text">{r.title}</p>
                <p className="text-sm text-text-secondary">{r.detail}</p>
              </div>
              <Badge variant="accent">{r.status}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock className="h-3.5 w-3.5" />
                {r.eta}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Decline
                </Button>
                <Button size="sm">Accept</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
