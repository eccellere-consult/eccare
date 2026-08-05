'use client';

import { useEffect, useState, useCallback } from 'react';
import { Phone, Trash2, CheckCircle2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Contact {
  id: string;
  name: string;
  phone: string;
  category: 'neighbor' | 'friend' | 'serviceProvider' | 'hospital' | 'other';
  providerType: string | null;
  sharedListingId: string | null;
  shareWithNeighbours: boolean;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

const CATEGORY_LABEL: Record<Contact['category'], string> = {
  neighbor: 'Neighbor',
  friend: 'Friend',
  serviceProvider: 'Service Provider',
  hospital: 'Hospital',
  other: 'Other',
};

export function ContactList({ elderUserId, refreshKey }: { elderUserId: string; refreshKey: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editShare, setEditShare] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [contactsRes, emergencyRes] = await Promise.all([
      fetch(`/api/v1/contacts?elderUserId=${elderUserId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/v1/emergency/contacts?elderUserId=${elderUserId}`, { credentials: 'include' }).then((r) => r.json()),
    ]);
    if (contactsRes.success) setContacts(contactsRes.data);
    if (emergencyRes.success) setEmergencyContacts(emergencyRes.data);
    setLoading(false);
  }, [elderUserId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/v1/contacts/${id}`, { method: 'DELETE', credentials: 'include' });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditShare(c.shareWithNeighbours);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id: string, category: Contact['category']) {
    if (!editName.trim() || !editPhone.trim()) {
      setEditError('Please enter a name and phone number.');
      return;
    }
    setBusyId(id);
    setEditError('');
    try {
      const res = await fetch(`/api/v1/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          ...(category === 'neighbor' ? { shareWithNeighbours: editShare } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not save changes.');
      setContacts((prev) => prev.map((c) => (c.id === id ? json.data : c)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;

  const isEmpty = contacts.length === 0 && emergencyContacts.length === 0;
  if (isEmpty) return <p className="text-text-secondary">No contacts added yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c) =>
        editingId === c.id ? (
          <Card key={c.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`edit-name-${c.id}`}>Name</Label>
                <Input id={`edit-name-${c.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`edit-phone-${c.id}`}>Phone number</Label>
                <Input id={`edit-phone-${c.id}`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              {c.category === 'neighbor' && (
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={editShare}
                    onChange={(e) => setEditShare(e.target.checked)}
                    className="h-5 w-5 rounded border-border"
                  />
                  Also show in your community&rsquo;s Neighbours directory
                </label>
              )}
              {editError && <p className="text-sm text-danger-600">{editError}</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === c.id} onClick={() => saveEdit(c.id, c.category)}>
                  {busyId === c.id ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card key={c.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-bold text-text">
                  <span className="truncate">{c.name}</span>
                  {(c.sharedListingId || c.shareWithNeighbours) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-label="Shared with community" />
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="muted">
                    {c.category === 'serviceProvider' && c.providerType ? c.providerType : CATEGORY_LABEL[c.category]}
                  </Badge>
                  {c.sharedListingId && <span className="text-xs text-success-600">Shared with community</span>}
                  {c.shareWithNeighbours && <span className="text-xs text-success-600">In Neighbours directory</span>}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{c.phone}</p>
              </div>
              <a
                href={`tel:${c.phone}`}
                aria-label={`Call ${c.name}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
              >
                <Phone className="h-5 w-5" />
              </a>
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === c.id}
                onClick={() => startEdit(c)}
                aria-label={`Edit ${c.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === c.id}
                onClick={() => handleDelete(c.id)}
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ),
      )}

      {emergencyContacts.map((c) => (
        <Card key={c.id} className="border-danger-100">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text">{c.name}</p>
              <div className="mt-0.5">
                <Badge variant="danger">Emergency Contact · {c.relationship}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{c.phone}</p>
              <p className="mt-1 text-xs text-text-secondary">Manage this on the Emergency tab.</p>
            </div>
            <a
              href={`tel:${c.phone}`}
              aria-label={`Call ${c.name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-600 text-white"
            >
              <Phone className="h-5 w-5" />
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
