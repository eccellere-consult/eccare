'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Pause, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Template {
  id: string;
  unitsPerMonth: number;
  isActive: boolean;
  createdAt: string;
  catalogItem: { name: string; price: string };
  provider: { businessName: string };
}

const SUGGESTION_INTERVAL_DAYS = 30;

/** Makes the pharmacy auto-reorder feature actually visible (the backend and
 *  suggestion cards existed, but nothing showed an ongoing template once set
 *  up — after a page reload there was no lasting sign it was working). Lists
 *  every active RecurringOrderTemplate with a rough "next reminder around"
 *  date (createdAt + ~30 days — the same cadence lib/recurring-orders.ts
 *  actually uses, so this is an honest estimate, not a separate guess) and a
 *  pause/resume toggle. Collapsed by default so it doesn't crowd the orders
 *  list when there's nothing to show. */
export function RecurringOrderTemplates({ elderUserId }: { elderUserId?: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
    fetch(`/api/v1/orders/recurring-templates${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setTemplates(j.data); })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderUserId]);

  async function togglePause(t: Template) {
    setBusyId(t.id);
    try {
      await fetch(`/api/v1/orders/recurring-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const active = templates.filter((t) => t.isActive);
  if (active.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="py-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-sm font-bold text-text">
            <RefreshCw className="h-4 w-4 text-primary-600" />
            Monthly reorders set up ({active.length})
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
        </button>

        {expanded && (
          <div className="mt-3 flex flex-col gap-2">
            {templates.map((t) => {
              const nextAround = new Date(new Date(t.createdAt).getTime() + SUGGESTION_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">
                      {t.catalogItem.name} × {t.unitsPerMonth}/month
                    </p>
                    <p className="text-xs text-text-secondary">
                      {t.provider.businessName}
                      {t.isActive
                        ? ` · Next reminder around ${nextAround.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
                        : ' · Paused'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => togglePause(t)}>
                    {t.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {t.isActive ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
