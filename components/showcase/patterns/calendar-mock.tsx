import { Clock, MapPin } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function CalendarMock({
  appointments,
}: {
  appointments: { day: string; month: string; title: string; time: string; place: string }[];
}) {
  return (
    <MockFrame>
      <div className="flex flex-col gap-4">
        {appointments.map((a, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-border bg-bg p-4">
            <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-600 py-2 text-white">
              <span className="text-xs font-semibold uppercase">{a.month}</span>
              <span className="text-2xl font-black">{a.day}</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-text">{a.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                <Clock className="h-3.5 w-3.5" />
                {a.time}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
                <MapPin className="h-3.5 w-3.5" />
                {a.place}
              </p>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
