'use client';

import { useEffect, useState } from 'react';
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

export function ContactsManager({ elderUserId, elderName }: { elderUserId: string; elderName: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/v1/emergency/contacts?elderUserId=${elderUserId}`, { credentials: 'include' });
    const json = await res.json();
    if (json.success) setContacts(json.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderUserId]);

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
        credentials: 'include',
        body: JSON.stringify({ name, phone, relationship, elderUserId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not add contact.');
      setName('');
      setPhone('');
      setRelationship('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this contact?')) return;
    await fetch(`/api/v1/emergency/contacts/${id}`, { method: 'DELETE', credentials: 'include' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{elderName}'s contacts</h1>
          <p className="mt-1 text-text-secondary">Notified automatically during an SOS alert.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <UserPlus className="h-5 w-5" />
          Add contact
        </Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-phone">Phone</Label>
                <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-rel">Relationship</Label>
                <Input id="c-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Daughter" />
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
        {loading ? (
          <p className="text-text-secondary">Loading...</p>
        ) : contacts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">No contacts added yet.</CardContent>
          </Card>
        ) : (
          contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 font-bold text-primary-900">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text">{contact.name}</p>
                  <p className="text-sm text-text-secondary">{contact.relationship} &middot; {contact.phone}</p>
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100"
                  aria-label={`Call ${contact.name}`}
                >
                  <Phone className="h-5 w-5" />
                </a>
                <button
                  onClick={() => handleRemove(contact.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-danger-600 hover:bg-danger-50"
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
