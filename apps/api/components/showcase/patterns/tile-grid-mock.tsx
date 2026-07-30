import type { LucideIcon } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function TileGridMock({
  greeting,
  tiles,
}: {
  greeting?: string;
  tiles: { icon: LucideIcon; label: string; sublabel?: string; accent?: 'primary' | 'accent' | 'danger' }[];
}) {
  return (
    <MockFrame>
      {greeting && <p className="mb-6 text-2xl font-bold text-text">{greeting}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map(({ icon: Icon, label, sublabel, accent = 'primary' }) => (
          <div
            key={label}
            className={{
              primary: 'border-primary-100 bg-primary-50',
              accent: 'border-accent-100 bg-accent-50',
              danger: 'border-danger-100 bg-danger-50',
            }[accent] + ' flex flex-col items-center gap-2 rounded-2xl border p-6 text-center'}
          >
            <Icon
              className={{
                primary: 'h-8 w-8 text-primary-600',
                accent: 'h-8 w-8 text-accent-600',
                danger: 'h-8 w-8 text-danger-600',
              }[accent]}
            />
            <p className="text-base font-bold text-text">{label}</p>
            {sublabel && <p className="text-xs text-text-secondary">{sublabel}</p>}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
