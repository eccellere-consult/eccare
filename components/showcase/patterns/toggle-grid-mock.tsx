import type { LucideIcon } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function ToggleGridMock({
  devices,
}: {
  devices: { icon: LucideIcon; label: string; on: boolean }[];
}) {
  return (
    <MockFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((d) => (
          <div key={d.label} className="flex items-center justify-between rounded-2xl border border-border bg-bg p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${d.on ? 'bg-accent-50 text-accent-600' : 'bg-border text-text-secondary'}`}>
                <d.icon className="h-5 w-5" />
              </div>
              <p className="font-bold text-text">{d.label}</p>
            </div>
            <div className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${d.on ? 'bg-accent-600 justify-end' : 'bg-border justify-start'}`}>
              <div className="h-5 w-5 rounded-full bg-white shadow" />
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
