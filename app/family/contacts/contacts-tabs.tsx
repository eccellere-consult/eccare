'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContactForm } from '@/components/contact-form';
import { ContactList } from '@/components/contact-list';
import { ContactsManager } from './contacts-manager';

export function ContactsTabs({
  elderUserId,
  elderName,
  inCommunity,
}: {
  elderUserId: string;
  elderName: string;
  inCommunity: boolean;
}) {
  const [tab, setTab] = useState<'emergency' | 'all'>('emergency');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
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
          <ContactsManager elderUserId={elderUserId} elderName={elderName} />
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text">{elderName}&rsquo;s contacts</h1>
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
                  elderUserId={elderUserId}
                  inCommunity={inCommunity}
                  onAdded={() => {
                    setShowForm(false);
                    setRefreshKey((k) => k + 1);
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            )}

            <div className="mt-6">
              <ContactList elderUserId={elderUserId} refreshKey={refreshKey} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
