'use client';

import { useState } from 'react';
import { Phone, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmergencyContactPicker } from '@/components/emergency-contact-picker';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function ElderContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [contacts, setContacts] = useState(initialContacts);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || phone.trim().length < 10 || !relationship.trim()) {
      setError(t('elder.contacts.fillAllFields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/emergency/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, relationship }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('elder.contacts.couldNotAdd'));
      setContacts((prev) => [...prev, json.data]);
      setName('');
      setPhone('');
      setRelationship('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('elder.contacts.couldNotAdd'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm(t('elder.contacts.confirmRemove'))) return;
    await fetch(`/api/v1/emergency/contacts/${id}`, { method: 'DELETE' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function reload() {
    const res = await fetch('/api/v1/emergency/contacts', { credentials: 'include' });
    const json = await res.json();
    if (json.success) setContacts(json.data);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('elder.contacts.yourFamily')}</h1>
          <p className="mt-1 text-text-secondary">{t('elder.contacts.tapToCall')}</p>
        </div>
        <div className="flex gap-2">
          <EmergencyContactPicker onAdded={reload} />
          <Button onClick={() => setShowForm((s) => !s)} size="lg">
            <UserPlus className="h-5 w-5" />
            {t('elder.contacts.add')}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-name">{t('elder.contacts.name')}</Label>
                <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('elder.contacts.namePlaceholder')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-phone">{t('elder.contacts.phone')}</Label>
                <Input id="e-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('elder.contacts.phonePlaceholder')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-rel">{t('elder.contacts.relationship')}</Label>
                <Input id="e-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={t('elder.contacts.relationshipPlaceholder')} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? t('elder.contacts.saving') : t('elder.contacts.save')}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              {t('elder.contacts.noContacts')}
            </CardContent>
          </Card>
        ) : (
          contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-text">{contact.name}</p>
                  <p className="text-sm text-text-secondary">{contact.relationship}</p>
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-900"
                  aria-label={`Call ${contact.name}`}
                >
                  <Phone className="h-5 w-5" />
                </a>
                <button
                  onClick={() => handleRemove(contact.id)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-danger-600 hover:bg-danger-50"
                  aria-label={`Remove ${contact.name}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
