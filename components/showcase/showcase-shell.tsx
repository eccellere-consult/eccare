import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PHASE_LABELS: Record<string, string> = {
  A: 'Phase A — Foundation',
  A2: 'Phase A2 — Community',
  B: 'Phase B — Health & Daily Care',
  C: 'Phase C — Ecosystem Services',
  D: 'Phase D — Voice & Polish',
  E: 'Phase E — Android App',
  F: 'Phase F — Lifestyle & Financial',
};

export function ShowcaseShell({
  featureNumber,
  phase,
  title,
  tagline,
  description,
  status,
  children,
}: {
  featureNumber: number;
  phase: string;
  title: string;
  tagline: string;
  description: string;
  status: 'live' | 'planned';
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6">
          <Link
            href="/showcase"
            className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
          >
            <ArrowLeft className="h-4 w-4" />
            All features
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-900">
              {featureNumber}
            </span>
            <Badge variant="muted">{PHASE_LABELS[phase] ?? phase}</Badge>
            <Badge variant={status === 'live' ? 'success' : 'accent'}>
              {status === 'live' ? 'Live today' : 'Illustrative preview'}
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-black text-text sm:text-4xl">{title}</h1>
            <p className="mt-1 text-lg font-semibold text-primary-600">{tagline}</p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">{description}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

export function MockFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8', className)}>
      {children}
    </div>
  );
}
