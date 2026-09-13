'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContactForm } from '@/components/contact-form';
import { ContactList } from '@/components/contact-list';
import { ContactsManager } from './contacts-manager';

interface Identity {
  id: string;
  name: string;
  inCommunity: boolean;
}

export function ContactsTabs({
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

  const [tab, setTab] = useState<'emergency' | 'all'>('emergency');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      {elder && (
        <div className="mb-4 flex h-12 w-fit min-w-[16rem] items-center rounded-xl bg-primary-50 p-1">
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

      <div className="flex gap-2 border-b border-border">
        {(['emergency', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-3 text-sm font-semibold transition-colors',
              tab === t ? 'border-b-2 border-primary-600 text-primary-900' : 'text-text-secondary',
            )}
          >
            {t === 'emergency' ? 'Emergency' : 'All Contacts'}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'emergency' ? (
          <ContactsManager elderUserId={active.id} elderName={active.name} isSelf={isSelf} />
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text">{isSelf ? 'Your contacts' : `${active.name}’s contacts`}</h1>
                <p className="mt-1 text-text-secondary">Neighbors, friends, service providers and more.</p>
              </div>
              {!showForm && (
                <Button onClick={() => setShowForm(true)}>
                  <UserPlus className="h-5 w-5" />
                  Add contact
                </Button>
              )}
            </div>

            {showForm && (
              <div className="mt-6">
                <ContactForm
                  elderUserId={active.id}
                  inCommunity={active.inCommunity}
                  onAdded={() => {
                    setShowForm(false);
                    setRefreshKey((k) => k + 1);
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            )}

            <div className="mt-6">
              <ContactList elderUserId={active.id} refreshKey={refreshKey} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
