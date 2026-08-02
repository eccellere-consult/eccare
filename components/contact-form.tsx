'use client';

import { useState } from 'react';
import { Contact as ContactIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isContactPickerSupported, pickContact } from '@/lib/contact-picker';

type FormCategory = 'neighbor' | 'friend' | 'serviceProvider' | 'emergencyContact' | 'hospital' | 'other';

const CATEGORY_OPTIONS: { value: FormCategory; label: string }[] = [
  { value: 'neighbor', label: 'Neighbor' },
  { value: 'friend', label: 'Friend' },
  { value: 'serviceProvider', label: 'Service Provider' },
  { value: 'emergencyContact', label: 'Emergency Contact' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'other', label: 'Other' },
];

export function ContactForm({
  elderUserId,
  inCommunity,
  onAdded,
  onCancel,
}: {
  elderUserId: string;
  inCommunity: boolean;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<FormCategory>('neighbor');
  const [providerType, setProviderType] = useState('');
  const [relationship, setRelationship] = useState('');
  const [shareWithCommunity, setShareWithCommunity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickerSupported = isContactPickerSupported();

  async function handlePick() {
    const picked = await pickContact();
    if (picked) {
      setName(picked.name);
      setPhone(picked.phone);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Please enter a name and phone number.');
      return;
    }
    if (category === 'emergencyContact' && !relationship.trim()) {
      setError('Please enter the relationship (e.g. Son, Neighbor, Doctor).');
      return;
    }

    setBusy(true);
    try {
      const endpoint = category === 'emergencyContact' ? '/api/v1/emergency/contacts' : '/api/v1/contacts';
      const body =
        category === 'emergencyContact'
          ? { elderUserId, name, phone, relationship }
          : {
              elderUserId,
              name,
              phone,
              category,
              providerType: category === 'serviceProvider' ? providerType || undefined : undefined,
              shareWithCommunity: shareWithCommunity || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not add contact.');

      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact.');
    } finally {
      setBusy(false);
    }
  }

  const canShare = inCommunity && (category === 'serviceProvider' || category === 'hospital');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {pickerSupported && (
          <Button type="button" variant="outline" onClick={handlePick} className="self-start">
            <ContactIcon className="h-4 w-4" />
            Pick from phone contacts
          </Button>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-phone">Phone number</Label>
            <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-category">Category</Label>
            <select
              id="contact-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FormCategory)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {category === 'serviceProvider' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-provider-type">What kind of service?</Label>
              <Input
                id="contact-provider-type"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                placeholder="Plumber, Electrician, Nurse…"
              />
            </div>
          )}

          {category === 'emergencyContact' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-relationship">Relationship</Label>
              <Input
                id="contact-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Son, Neighbor, Doctor…"
              />
              <p className="text-xs text-text-secondary">
                This goes into your Emergency Contacts list and can be notified during an SOS.
              </p>
            </div>
          )}

          {canShare && (
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={shareWithCommunity}
                onChange={(e) => setShareWithCommunity(e.target.checked)}
                className="h-5 w-5 rounded border-border"
              />
              Also share with your community&rsquo;s Vendors directory
            </label>
          )}

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add contact'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
