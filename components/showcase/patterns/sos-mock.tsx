import { AlertTriangle, MapPin, Users } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function SosMock({
  heading,
  subtext,
  buttonLabel,
  notified,
}: {
  heading: string;
  subtext: string;
  buttonLabel: string;
  notified: string[];
}) {
  return (
    <MockFrame className="flex flex-col items-center text-center">
      <p className="text-2xl font-bold text-text">{heading}</p>
      <p className="mt-2 max-w-md text-text-secondary">{subtext}</p>
      <div className="my-8 flex h-40 w-40 items-center justify-center rounded-full bg-danger-600 shadow-lg shadow-danger-100">
        <div className="flex flex-col items-center gap-1 text-white">
          <AlertTriangle className="h-10 w-10" />
          <span className="text-lg font-black">{buttonLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <MapPin className="h-4 w-4" />
        Live location shared automatically
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Users className="h-4 w-4 text-text-secondary" />
        {notified.map((name) => (
          <span key={name} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-900">
            {name}
          </span>
        ))}
      </div>
    </MockFrame>
  );
}
