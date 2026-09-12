'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContactForm } from '@/components/contact-form';
import { ContactList } from '@/components/contact-list';
import { ElderContactsClient } from './contacts-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function ContactsTabs({
  elderUserId,
  initialEmergencyContacts,
  inCommunity,
}: {
  elderUserId: string;
  initialEmergencyContacts: EmergencyContact[];
  inCommunity: boolean;
}) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [tab, setTab] = useState<'emergency' | 'all'>('emergency');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <div className="flex gap-2 border-b border-border">
        {(['emergency', 'all'] as const).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={cn(
              'px-4 py-3 text-sm font-semibold transition-colors',
              tab === tabId ? 'border-b-2 border-primary-600 text-primary-900' : 'text-text-secondary',
            )}
          >
            {tabId === 'emergency' ? t('elder.contacts.emergencyTab') : t('elder.contacts.allContactsTab')}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'emergency' ? (
          <ElderContactsClient initialContacts={initialEmergencyContacts} />
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text">{t('elder.contacts.allContactsTitle')}</h1>
                <p className="mt-1 text-text-secondary">{t('elder.contacts.allContactsSubtitle')}</p>
              </div>
              {!showForm && (
                <Button onClick={() => setShowForm(true)} size="lg">
                  <UserPlus className="h-5 w-5" />
                  {t('elder.contacts.add')}
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
