import Link from 'next/link';
import { SHOWCASE_FEATURES } from '@/lib/showcase-data';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const PHASE_ORDER = ['A', 'A2', 'B', 'C', 'D', 'E', 'F'];
const PHASE_LABELS: Record<string, string> = {
  A: 'Phase A — Foundation & Safety',
  A2: 'Phase A2 — Community & Local Services',
  B: 'Phase B — Health & Daily Care',
  C: 'Phase C — Ecosystem Services',
  D: 'Phase D — Voice, Social & Polish',
  E: 'Phase E — Android App',
  F: 'Phase F — Lifestyle & Financial',
};

export const dynamic = 'force-static';

export default function ShowcaseIndexPage() {
  const liveCount = SHOWCASE_FEATURES.filter((f) => f.status === 'live').length;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-4xl font-black text-primary-600">EC — Feature Showcase</h1>
          <p className="mt-2 max-w-2xl text-lg text-text-secondary">
            Every feature in the roadmap, illustrated with realistic sample data — elder-friendly, world-class UI/UX,
            whether it's live today or still ahead of us.
          </p>
          <p className="mt-3 text-sm font-semibold text-text-secondary">
            {liveCount} of {SHOWCASE_FEATURES.length} features are genuinely live today. The rest are illustrative previews.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {PHASE_ORDER.map((phase) => {
          const features = SHOWCASE_FEATURES.filter((f) => f.phase === phase);
          if (features.length === 0) return null;
          return (
            <section key={phase} className="mb-12">
              <h2 className="mb-4 text-xl font-bold text-text">{PHASE_LABELS[phase]}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f) => (
                  <Link key={f.slug} href={`/showcase/${f.slug}`}>
                    <Card className="h-full p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-900">
                          {f.number}
                        </span>
                        <Badge variant={f.status === 'live' ? 'success' : 'accent'}>
                          {f.status === 'live' ? 'Live' : 'Preview'}
                        </Badge>
                      </div>
                      <p className="mt-3 font-bold text-text">{f.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">{f.tagline}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
