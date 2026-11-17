'use client';

import { useState } from 'react';
import { Sparkles, X, Check, TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhotoUploadButtons } from '@/components/photo-upload-buttons';
import { shrinkPhoto } from '@/lib/shrink-photo';

interface Row {
  key: number;
  keep: boolean;
  name: string;
  category: string;
  description: string;
  price: string; // typed by the shop; pre-filled only when the photo showed a printed price
  fromPhoto: boolean; // the price was read from a tag in the photo: worth a second look
}

interface DraftItem {
  name: string;
  category: string;
  description: string;
  price: number | null;
}

const field =
  'h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

/**
 * "Add many from a shelf photo": the shop photographs a shelf, counter or price list, the photo helper
 * lists the products it can see, and the shop ticks, fixes and saves them all at once. Nothing is
 * saved until the shop presses the button, a missing price is never guessed, and every saved item
 * starts without a photo of its own (the catalogue page then nudges the shop to add them).
 */
export function ShelfBulkAdd({ onClose, onSaved }: { onClose: () => void; onSaved: (result: { created: number; skipped: string[] }) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setError('');
    setNote('');
    setRows(null);
    setReading(true);
    try {
      // A shelf needs more detail than one product, so the photo is shrunk less.
      const small = await shrinkPhoto(picked, 2000, 0.85);
      const body = new FormData();
      body.append('file', small);
      const res = await fetch('/api/v1/provider/catalog/draft-shelf', { method: 'POST', credentials: 'include', body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not read the photo. Please try again.');
      const items: DraftItem[] | null = json.data.items;
      if (!items || items.length === 0) {
        setNote(json.data.reason ?? 'No products found. Please try another photo.');
        return;
      }
      setRows(
        items.map((it, i) => ({
          key: i,
          keep: true,
          name: it.name,
          category: it.category,
          description: it.description,
          price: it.price != null ? String(it.price) : '',
          fromPhoto: it.price != null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the photo. Please try again.');
    } finally {
      setReading(false);
    }
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  const kept = rows?.filter((r) => r.keep) ?? [];
  const priceOf = (r: Row) => Number(r.price);
  const incomplete = kept.filter((r) => !r.name.trim() || !(priceOf(r) > 0));
  const canSave = kept.length > 0 && incomplete.length === 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/provider/catalog/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: kept.map((r) => ({
            name: r.name.trim(),
            price: priceOf(r),
            category: r.category.trim() || undefined,
            description: r.description.trim() || undefined,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save the items. Please try again.');
      onSaved({ created: json.data.created ?? 0, skipped: json.data.skipped ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the items. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 border-primary-100">
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">Add many items from one photo</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!rows && (
          <div className="flex flex-col gap-4">
            <p className="text-text-secondary">
              Photograph a shelf, a counter or your printed price list. Stand close, use daylight, and keep the products facing you. The photo
              helper lists what it can see, and you check each one before it is added.
            </p>
            <PhotoUploadButtons idPrefix="shelf" onFile={onPhoto} disabled={reading} busyLabel={reading ? 'Reading photo…' : undefined} />
            {reading && (
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-600" aria-live="polite">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Looking at your photo. This can take about 20 seconds…
              </p>
            )}
            {note && <p className="text-sm font-semibold text-accent-900">{note}</p>}
            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>
        )}

        {rows && (
          <div className="flex flex-col gap-4">
            <p className="text-text-secondary">
              Found {rows.length} item{rows.length === 1 ? '' : 's'}. Untick anything wrong, fix the names, and type any price that is missing.
              Prices are never guessed.{' '}
              <button type="button" onClick={() => { setRows(null); setNote(''); }} disabled={saving} className="font-semibold text-primary-600 underline">
                Use another photo
              </button>
            </p>

            <ul className="flex flex-col gap-3">
              {rows.map((r) => {
                const needsPrice = r.keep && !(priceOf(r) > 0);
                return (
                  <li key={r.key} className={`rounded-2xl border p-3 ${r.keep ? 'border-border bg-surface' : 'border-border bg-primary-50/50 opacity-60'}`}>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-text">
                      <input type="checkbox" checked={r.keep} onChange={(e) => update(r.key, { keep: e.target.checked })} className="h-6 w-6 accent-primary-600" />
                      Add this item
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem]">
                      <input aria-label="Item name" className={field} value={r.name} maxLength={160} disabled={!r.keep} onChange={(e) => update(r.key, { name: e.target.value })} />
                      <div>
                        <input
                          aria-label="Price in rupees"
                          inputMode="decimal"
                          className={`${field} ${needsPrice ? 'border-accent-600 ring-1 ring-accent-600' : ''}`}
                          placeholder="Price ₹"
                          value={r.price}
                          disabled={!r.keep}
                          onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d.]/g, ''), fromPhoto: false })}
                        />
                      </div>
                    </div>
                    <input
                      aria-label="Category"
                      className={`${field} mt-2`}
                      placeholder="Category (optional)"
                      value={r.category}
                      maxLength={60}
                      disabled={!r.keep}
                      onChange={(e) => update(r.key, { category: e.target.value })}
                    />
                    {r.description && <p className="mt-2 text-sm text-text-secondary">{r.description}</p>}
                    {needsPrice && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent-900">
                        <TriangleAlert className="h-3.5 w-3.5" /> Type the price to add this item.
                      </p>
                    )}
                    {r.keep && r.fromPhoto && priceOf(r) > 0 && <p className="mt-1.5 text-xs text-text-secondary">Price read from the tag in your photo. Please check it.</p>}
                  </li>
                );
              })}
            </ul>

            {error && <p className="text-sm text-danger-600">{error}</p>}

            <div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg md:bottom-4">
              <Button onClick={save} disabled={!canSave} className="shrink-0">
                <Check className="h-4 w-4" />
                {saving ? 'Adding…' : `Add ${kept.length} item${kept.length === 1 ? '' : 's'}`}
              </Button>
              {incomplete.length > 0 && (
                <span className="text-xs font-semibold text-text-secondary">
                  {incomplete.length} still need a price or name
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
