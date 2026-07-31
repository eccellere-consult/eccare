import { Phone, Star, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MockFrame } from '../showcase-shell';

export function DirectoryMock({
  listings,
}: {
  listings: { icon: LucideIcon; name: string; category: string; rating: string; distance: string }[];
}) {
  return (
    <MockFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        {listings.map((l) => (
          <div key={l.name} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50">
                <l.icon className="h-5 w-5 text-primary-600" />
              </div>
              <Badge variant="muted">{l.distance}</Badge>
            </div>
            <div>
              <p className="font-bold text-text">{l.name}</p>
              <p className="text-sm text-text-secondary">{l.category}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-semibold text-accent-600">
                <Star className="h-4 w-4 fill-current" />
                {l.rating}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white">
                <Phone className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
