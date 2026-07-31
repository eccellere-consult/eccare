import { Check, X } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function ChecklistMock({
  items,
}: {
  items: { label: string; pass: boolean; detail: string }[];
}) {
  return (
    <MockFrame>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-4 rounded-2xl border border-border bg-bg p-4">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                item.pass ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
              }`}
            >
              {item.pass ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-bold text-text">{item.label}</p>
              <p className="text-sm text-text-secondary">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
