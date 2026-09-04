'use client';

import { useEffect, useState } from 'react';
import { Phone, Trash2, UserPlus, Link2, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  linkedUserId: string | null;
  priorityLevel: 'primary' | 'secondary' | 'backup' | null;
}
interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  kind: 'family' | 'volunteer';
  relationship: string;
}

const PRIORITY_LABEL: Record<NonNullable<Contact['priorityLevel']>, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  backup: 'Backup',
};
const PRIORITY_OPTIONS = ['primary', 'secondary', 'backup'] as const;

export function ContactsManager({ elderUserId, elderName }: { elderUserId: string; elderName: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Emergency Contact Matrix — linking a registered volunteer or family member
  // with a priority level, separate from the free-text form above.
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<(typeof PRIORITY_OPTIONS)[number]>('primary');
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);

  const linkedCount = contacts.filter((c) => c.linkedUserId).length;
  const takenPriorities = new Set(contacts.filter((c) => c.priorityLevel).map((c) => c.priorityLevel));

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/v1/emergency/contacts?elderUserId=${elderUserId}`, { credentials: 'include' });
    const json = await res.json();
    if (json.success) setContacts(json.data);
    setLoading(false);
  }

  async function loadCandidates() {
    const res = await fetch(`/api/v1/emergency/contacts/linkable?elderUserId=${elderUserId}`, { credentials: 'include' });
    const json = await res.json();
    if (json.success) setCandidates(json.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderUserId]);

  useEffect(() => {
    if (showLinkForm) loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLinkForm, elderUserId]);

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

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError('');
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    if (!candidate) {
      setLinkError('Please select someone to link.');
      return;
    }
    if (!candidate.phone) {
      setLinkError("This person doesn't have a phone number on file, so they can't be linked here.");
      return;
    }
    setLinking(true);
    try {
      const res = await fetch('/api/v1/emergency/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          elderUserId,
          name: candidate.name,
          phone: candidate.phone,
          relationship: candidate.relationship,
          linkedUserId: candidate.id,
          priorityLevel,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not link this contact.');
      setSelectedCandidateId('');
      setShowLinkForm(false);
      await load();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not link this contact.');
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this contact?')) return;
    await fetch(`/api/v1/emergency/contacts/${id}`, { method: 'DELETE', credentials: 'include' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{elderName}'s contacts</h1>
          <p className="mt-1 text-text-secondary">Notified automatically during an SOS alert.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLinkForm((s) => !s)} disabled={linkedCount >= 3}>
            <Link2 className="h-5 w-5" />
            Link volunteer/family
          </Button>
          <Button onClick={() => setShowForm((s) => !s)}>
            <UserPlus className="h-5 w-5" />
            Add contact
          </Button>
        </div>
      </div>

      {showLinkForm && (
        <Card className="mt-4 border-accent-100 bg-accent-50">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-accent-900">
              Emergency Contact Matrix — link up to 3 registered volunteers or family members
              ({linkedCount}/3 used)
            </p>
            {candidates.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">
                No linkable volunteers or family members found yet — a family member needs an accepted
                invite, or your community needs a verified volunteer.
              </p>
            ) : (
              <form onSubmit={handleLink} className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="link-person">Person</Label>
                  <select
                    id="link-person"
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    <option value="">Select…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.relationship}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Priority level</Label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={takenPriorities.has(p)}
                        onClick={() => setPriorityLevel(p)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${priorityLevel === p ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}
                      >
                        {PRIORITY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>
                {linkError && <p className="text-sm text-danger-600">{linkError}</p>}
                <Button type="submit" disabled={linking || !selectedCandidateId} className="w-fit">
                  {linking ? 'Linking…' : 'Link contact'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text">{contact.name}</p>
                    {contact.priorityLevel && (
                      <Badge variant="success">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        {PRIORITY_LABEL[contact.priorityLevel]}
                      </Badge>
                    )}
                  </div>
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
