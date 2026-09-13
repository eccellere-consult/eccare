'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { OrdersList } from '@/components/orders-list';

interface Identity {
  id: string;
  name: string;
}

export function OrdersTabs({
  elder,
  self,
}: {
  /** null when the caregiver has no accepted elder yet — "for myself" becomes
   *  the only option rather than a dead end. */
  elder: Identity | null;
  self: Identity;
}) {
  const [actingAs, setActingAs] = useState<'elder' | 'self'>(elder ? 'elder' : 'self');
  const active = actingAs === 'elder' && elder ? elder : self;
  const isSelf = active.id === self.id;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Orders</h1>
      <p className="mt-1 text-text-secondary">
        {isSelf ? 'Your purchases from community vendors.' : 'Purchases from community vendors.'}
      </p>

      {elder && (
        <div className="mt-4 flex h-12 w-fit min-w-[16rem] items-center rounded-xl bg-primary-50 p-1">
          {([
            ['elder', elder.name],
            ['self', 'For myself'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActingAs(value)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                actingAs === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <OrdersList elderUserId={active.id} />
      </div>
    </div>
  );
}
