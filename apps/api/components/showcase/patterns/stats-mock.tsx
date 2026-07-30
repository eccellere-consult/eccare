import type { LucideIcon } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function StatsMock({
  stats,
  chartBars,
}: {
  stats: { icon: LucideIcon; label: string; value: string; tone?: 'primary' | 'accent' | 'success' | 'danger' }[];
  chartBars?: number[];
}) {
  const toneClass: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    success: 'bg-success-50 text-success-600',
    danger: 'bg-danger-50 text-danger-600',
  };
  return (
    <MockFrame>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-bg p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${toneClass[s.tone ?? 'primary']}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-text">{s.value}</p>
            <p className="text-sm text-text-secondary">{s.label}</p>
          </div>
        ))}
      </div>
      {chartBars && (
        <div className="mt-6 flex h-32 items-end gap-2 rounded-2xl border border-border bg-bg p-5">
          {chartBars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-primary-600" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </MockFrame>
  );
}
