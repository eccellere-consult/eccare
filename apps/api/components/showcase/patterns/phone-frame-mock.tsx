import type { LucideIcon } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function PhoneFrameMock({
  tiles,
}: {
  tiles: { icon: LucideIcon; label: string }[];
}) {
  return (
    <MockFrame className="flex justify-center">
      <div className="w-72 rounded-[2.5rem] border-8 border-primary-900 bg-bg p-4 shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="h-1.5 w-16 rounded-full bg-primary-900/30" />
        </div>
        <p className="mb-4 text-center text-lg font-black text-primary-600">EC</p>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 rounded-2xl bg-primary-50 p-4 text-center">
              <Icon className="h-6 w-6 text-primary-600" />
              <span className="text-xs font-bold text-text">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </MockFrame>
  );
}
