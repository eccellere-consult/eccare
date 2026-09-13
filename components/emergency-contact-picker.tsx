'use client';

import { useState } from 'react';
import { Users, Phone as PhoneIcon, Check, X, ShieldPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isContactPickerSupported, pickContacts } from '@/lib/contact-picker';

interface SavedContact {
  id: string;
  name: string;
  phone: string;
  category: string;
}

interface StagedRow {
  key: string;
  name: string;
  phone: string;
  relationship: string;
  status: 'pending' | 'adding' | 'added' | 'error';
  error?: string;
}

/** "Select from contacts" — promotes existing contacts (already saved in the
 *  general contact book, or freshly picked from the phone) into Emergency
 *  Contacts, prompting for the one field the general contact book doesn't
 *  carry: relationship. Two starting points, one shared review step:
 *  checkboxes over the elder's saved Contact rows, or the OS contact picker
 *  for anyone not already saved — both land in the same staged list where a
 *  relationship is filled in before the actual POST /api/v1/emergency/contacts
 *  calls (looped sequentially, same idiom as ContactForm's bulk import, so a
 *  partial failure stays visible per row instead of being silently dropped). */
export function EmergencyContactPicker({
  elderUserId,
  onAdded,
}: {
  elderUserId?: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [savedContacts, setSavedContacts] = useState<SavedContact[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<StagedRow[] | null>(null);
  const [adding, setAdding] = useState(false);

  const pickerSupported = isContactPickerSupported();

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    setStaged(null);
    setSelectedIds(new Set());
    if (next && savedContacts === null) {
      setLoadingSaved(true);
      try {
        const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
        const res = await fetch(`/api/v1/contacts${qs}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setSavedContacts(json.data);
      } finally {
        setLoadingSaved(false);
      }
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function continueWithSelected() {
    const rows = (savedContacts ?? [])
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ key: c.id, name: c.name, phone: c.phone, relationship: '', status: 'pending' as const }));
    setStaged(rows);
  }

  async function pickFromPhone() {
    const picked = await pickContacts(true);
    if (picked.length === 0) return;
    setStaged(
      picked.map((c, i) => ({
        key: `phone-${i}-${c.phone}`,
        name: c.name,
        phone: c.phone,
        relationship: '',
        status: 'pending' as const,
      })),
    );
  }

  function updateRow(key: string, patch: Partial<StagedRow>) {
    setStaged((prev) => prev && prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setStaged((prev) => prev && prev.filter((r) => r.key !== key));
  }

  async function addStaged() {
    if (!staged) return;
    const missing = staged.some((r) => r.status === 'pending' && !r.relationship.trim());
    if (missing) return;

    setAdding(true);
    let anyAdded = false;
    for (const row of staged) {
      if (row.status === 'added') continue;
      updateRow(row.key, { status: 'adding', error: undefined });
      try {
        const res = await fetch('/api/v1/emergency/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ elderUserId, name: row.name, phone: row.phone, relationship: row.relationship.trim() }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not add this contact.');
        updateRow(row.key, { status: 'added' });
        anyAdded = true;
      } catch (err) {
        updateRow(row.key, { status: 'error', error: err instanceof Error ? err.message : 'Could not add this contact.' });
      }
    }
    setAdding(false);
    if (anyAdded) onAdded();
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={toggleOpen}>
        <ShieldPlus className="h-5 w-5" />
        Select from contacts
      </Button>
    );
  }

  return (
    <Card className="mt-4 w-full border-accent-100 bg-accent-50">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <p className="font-bold text-text">Add emergency contacts from your contacts</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {staged ? (
          <>
            <p className="text-sm text-text-secondary">Add a relationship for each person, then add them.</p>
            <div className="flex flex-col gap-3">
              {staged.map((row) => (
                <div key={row.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text">{row.name}</p>
                      <p className="text-xs text-text-secondary">{row.phone}</p>
                    </div>
                    {row.status === 'added' ? (
                      <Check className="h-5 w-5 shrink-0 text-success-600" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={adding}
                        aria-label="Remove"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`rel-${row.key}`}>Relationship</Label>
                    <Input
                      id={`rel-${row.key}`}
                      value={row.relationship}
                      onChange={(e) => updateRow(row.key, { relationship: e.target.value })}
                      placeholder="Daughter, Neighbour, Friend…"
                      disabled={row.status === 'adding' || row.status === 'added'}
                    />
                  </div>
                  {row.status === 'error' && <p className="text-xs text-danger-600">{row.error}</p>}
                </div>
              ))}
            </div>
            {staged.length === 0 ? (
              <p className="text-sm text-text-secondary">No contacts selected.</p>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={adding || staged.every((r) => r.status === 'added') || staged.some((r) => r.status === 'pending' && !r.relationship.trim())}
                  onClick={addStaged}
                >
                  {adding ? 'Adding…' : `Add ${staged.filter((r) => r.status !== 'added').length} as emergency contacts`}
                </Button>
                <Button type="button" variant="outline" onClick={() => setStaged(null)}>
                  Back
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {pickerSupported && (
              <Button type="button" variant="outline" className="w-fit" onClick={pickFromPhone}>
                <PhoneIcon className="h-4 w-4" />
                Pick from phone
              </Button>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-text">Or select from your saved contacts</p>
              {loadingSaved ? (
                <p className="text-sm text-text-secondary">Loading…</p>
              ) : !savedContacts || savedContacts.length === 0 ? (
                <p className="text-sm text-text-secondary">No saved contacts yet — use &quot;Pick from phone&quot; above, or add contacts from the All Contacts tab first.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedContacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-5 w-5 rounded border-border"
                      />
                      <Users className="h-4 w-4 shrink-0 text-text-secondary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{c.name}</span>
                      <span className="shrink-0 text-xs text-text-secondary">{c.phone}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {savedContacts && savedContacts.length > 0 && (
              <Button type="button" disabled={selectedIds.size === 0} onClick={continueWithSelected} className="w-fit">
                Continue with {selectedIds.size || ''} selected
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
