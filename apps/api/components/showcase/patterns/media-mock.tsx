import type { LucideIcon } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function MediaMock({
  cards,
}: {
  cards: { icon: LucideIcon; title: string; subtitle: string }[];
}) {
  return (
    <MockFrame>
      <div className="flex flex-col gap-3">
        {cards.map((c) => (
          <div key={c.title} className="flex items-center gap-4 rounded-2xl border border-border bg-bg p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-50">
              <c.icon className="h-6 w-6 text-accent-600" />
            </div>
            <div>
              <p className="font-bold text-text">{c.title}</p>
              <p className="text-sm text-text-secondary">{c.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
