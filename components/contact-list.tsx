'use client';

import { useEffect, useState, useCallback } from 'react';
import { Phone, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Contact {
  id: string;
  name: string;
  phone: string;
  category: 'neighbor' | 'friend' | 'serviceProvider' | 'hospital' | 'other';
  providerType: string | null;
  sharedListingId: string | null;
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

  if (loading) return <p className="text-text-secondary">Loading…</p>;

  const isEmpty = contacts.length === 0 && emergencyContacts.length === 0;
  if (isEmpty) return <p className="text-text-secondary">No contacts added yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-bold text-text">
                <span className="truncate">{c.name}</span>
                {c.sharedListingId && <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-label="Shared with community" />}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant="muted">
                  {c.category === 'serviceProvider' && c.providerType ? c.providerType : CATEGORY_LABEL[c.category]}
                </Badge>
                {c.sharedListingId && <span className="text-xs text-success-600">Shared with community</span>}
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
              onClick={() => handleDelete(c.id)}
              aria-label={`Delete ${c.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}

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
