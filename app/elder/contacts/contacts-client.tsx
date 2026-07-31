'use client';

import { useState } from 'react';
import { Phone, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function ElderContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
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
      setError('Please fill in all fields with a valid phone number.');
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
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not add contact.');
      setContacts((prev) => [...prev, json.data]);
      setName('');
      setPhone('');
      setRelationship('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this contact?')) return;
    await fetch(`/api/v1/emergency/contacts/${id}`, { method: 'DELETE' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Your family</h1>
          <p className="mt-1 text-text-secondary">Tap a name to call them.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} size="lg">
          <UserPlus className="h-5 w-5" />
          Add
        </Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-name">Name</Label>
                <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-phone">Phone</Label>
                <Input id="e-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="e-rel">Relationship</Label>
                <Input id="e-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Daughter" />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
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
              No family contacts added yet.
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
