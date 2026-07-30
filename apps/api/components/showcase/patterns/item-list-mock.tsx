import { Plus, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MockFrame } from '../showcase-shell';

export function ItemListMock({
  icon: Icon,
  addLabel,
  items,
}: {
  icon: LucideIcon;
  addLabel: string;
  items: { title: string; detail: string; badge?: string; badgeVariant?: 'default' | 'success' | 'accent' | 'danger' | 'muted' }[];
}) {
  return (
    <MockFrame>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold text-text">Your list</p>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-border bg-bg p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <Icon className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-text">{item.title}</p>
              <p className="text-sm text-text-secondary">{item.detail}</p>
            </div>
            {item.badge && <Badge variant={item.badgeVariant ?? 'default'}>{item.badge}</Badge>}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
