'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface Preference {
  key: string;
  label: string;
  description: string;
  push: boolean;
  email: boolean;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors',
        checked ? 'justify-end bg-primary-600' : 'justify-start bg-border',
      )}
    >
      <span className="h-6 w-6 rounded-full bg-white shadow" />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { data, loading, error, setData } = useCommunityData<Preference[]>(
    '/notifications/preferences',
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function update(category: string, patch: { push?: boolean; email?: boolean }) {
    // Optimistic — a toggle that lags feels broken, and the failure path just reverts.
    const previous = data;
    setData((prev) =>
      (prev ?? []).map((p) => (p.key === category ? { ...p, ...patch } : p)),
    );
    setSaving(category);
    try {
      await communityApi.put('/notifications/preferences', { category, ...patch });
    } catch {
      setData(previous ?? null);
    } finally {
      setSaving(null);
    }
  }

  return (
    <CommunityPageFrame
      title="Notification settings"
      subtitle="Choose what you want to hear about. Emergency alerts are always on."
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-3">
        {data?.map((p) => (
          <Card key={p.key}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text">{p.label}</p>
                <p className="text-sm text-text-secondary">{p.description}</p>
              </div>
              <Toggle
                checked={p.push}
                onChange={(v) => update(p.key, { push: v })}
                label={`${p.label} notifications`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
