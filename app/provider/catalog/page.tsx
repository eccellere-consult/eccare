'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Trash2, Pencil, Camera, Sparkles, ImagePlus, LayoutGrid, X } from 'lucide-react';
import { ShelfBulkAdd } from '@/components/provider/shelf-bulk-add';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PhotoUploadButtons } from '@/components/photo-upload-buttons';
import { shrinkPhoto } from '@/lib/shrink-photo';

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imagePath: string | null;
  category: string | null;
  weightKg?: string | null;
  parcelSize?: string | null;
  inStock: boolean;
}

async function api(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  } catch {
    // The request never completed (signal lost, or the phone could not send the picture).
    throw new Error('Could not reach the server. Please check your internet connection and try again.');
  }
  // Read the reply as text first: when the server (or the host in front of it) answers with a plain
  // page instead of our usual message, show the start of it so the cause can be traced.
  const raw = await res.text().catch(() => '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: { success?: boolean; data?: any; error?: { message?: string } } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* not our usual reply */
  }
  const pageText = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!res.ok || !json.success) {
    // No message from the server usually means the reply was not ours at all (a host or network
    // error page): say which status came back so it can be traced, not just "something went wrong".
    throw new Error(
      json?.error?.message ||
        `Something went wrong (server answered ${res.status}${pageText ? `: ${pageText}` : ''}). Please try again.`,
    );
  }
  return json.data;
}

const EMPTY_FORM = { name: '', description: '', price: '', category: '', weightKg: '', parcelSize: '' };

export default function ProviderCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api('/provider/catalog'));
    } catch {
      /* leave list empty */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Free the browser memory held by a photo preview when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(),
    [items],
  );
  const withoutPhoto = items.filter((i) => !i.imagePath).length;

  function resetForm() {
    setForm(EMPTY_FORM);
    setPhoto(null);
    setPreview(null);
    setExistingImage(null);
    setEditingId(null);
    setAiNote('');
    setError('');
  }

  function openAdd() {
    resetForm();
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function openEdit(item: CatalogItem) {
    resetForm();
    setEditingId(item.id);
    setExistingImage(item.imagePath);
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: String(Number(item.price)),
      category: item.category ?? '',
      weightKg: item.weightKg ? String(Number(item.weightKg)) : '',
      parcelSize: item.parcelSize ?? '',
    });
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  /** A photo was picked: shrink it, show it, and (for a new item) ask the photo helper to fill in
   *  the name, category and description. Anything the shopkeeper already typed is left alone. */
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setError('');
    setAiNote('');
    const small = await shrinkPhoto(picked);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));

    if (form.name.trim() && form.description.trim()) return; // nothing left to fill in
    setDrafting(true);
    try {
      const body = new FormData();
      body.append('file', small);
      const result: { draft: { name: string; category: string; description: string } | null; reason: string | null } =
        await api('/provider/catalog/draft', { method: 'POST', body });
      if (result.draft) {
        setForm((f) => ({
          ...f,
          name: f.name || result.draft!.name,
          category: f.category || result.draft!.category,
          description: f.description || result.draft!.description,
          price: f.price,
        }));
        setAiNote('The photo helper filled in the name, category and description. Please check them, then type the price.');
      } else if (result.reason) {
        setAiNote(result.reason);
      }
    } catch (err) {
      setAiNote(err instanceof Error ? err.message : 'The photo helper is not available. Please type the details.');
    } finally {
      setDrafting(false);
    }
  }

  async function uploadPhotoFor(id: string, file: File) {
    const send = () => {
      const body = new FormData();
      body.append('file', file);
      return api(`/provider/catalog/${id}/image`, { method: 'POST', body });
    };
    try {
      await send();
    } catch {
      // The first photo request straight after saving a new item sometimes fails on the host, while
      // the very same request a moment later goes through (shopkeepers saw "add photo" work the
      // second time). Try once more, quietly, before telling anyone.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await send();
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price <= 0) {
      setError('Please enter a name and a valid price.');
      return;
    }
    setBusy(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      category: form.category.trim(),
      weightKg: form.weightKg.trim() && Number(form.weightKg) >= 0 ? Number(form.weightKg) : null,
      parcelSize: (form.parcelSize || null) as 'small' | 'medium' | 'large' | null,
    };
    try {
      let id = editingId;
      if (editingId) {
        await api(`/provider/catalog/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const created: CatalogItem = await api('/provider/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            description: payload.description || undefined,
            category: payload.category || undefined,
          }),
        });
        id = created.id;
      }
      if (photo && id) {
        try {
          await uploadPhotoFor(id, photo);
        } catch (err) {
          // The item is saved; only the photo failed. Say so, and keep the list in step.
          setFormOpen(false);
          resetForm(); // clears any old message, so the new one is set after it
          setError(`The item was saved, but its photo could not be uploaded: ${err instanceof Error ? err.message : 'please try again'}. Use "Take photo" or "Upload" on the item to add it.`);
          await load();
          return;
        }
      }
      setFormOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the item.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStock(item: CatalogItem) {
    await api(`/provider/catalog/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock: !item.inStock }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remove this item from your catalog?')) return;
    await api(`/provider/catalog/${id}`, { method: 'DELETE' });
    load();
  }

  async function replacePhoto(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setUploadingId(id);
    setError('');
    try {
      await uploadPhotoFor(id, await shrinkPhoto(picked));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploadingId(null);
    }
  }

  const shownImage = preview ?? existingImage;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Your catalog</h1>
          <p className="mt-1 text-text-secondary">
            Items elders and family can browse and buy. Clear photos help them choose.
          </p>
        </div>
        {!formOpen && !shelfOpen && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openAdd}>
              <Camera className="h-4 w-4" />
              Add item with a photo
            </Button>
            <Button variant="outline" onClick={() => { setNotice(''); setShelfOpen(true); }}>
              <LayoutGrid className="h-4 w-4" />
              Add many from a shelf photo
            </Button>
          </div>
        )}
      </div>

      {shelfOpen && (
        <ShelfBulkAdd
          onClose={() => setShelfOpen(false)}
          onSaved={({ created, skipped }) => {
            setShelfOpen(false);
            setNotice(
              `${created === 0 ? 'No new items were added' : created === 1 ? '1 item added' : `${created} items added`}.` +
                (skipped.length > 0
                  ? ` ${skipped.length === 1 ? '1 was' : `${skipped.length} were`} already in your catalogue and skipped: ${skipped.join(', ')}.`
                  : ''),
            );
            load();
          }}
        />
      )}

      {notice && !shelfOpen && (
        <p className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm font-semibold text-success-600" role="status">
          {notice}
        </p>
      )}

      {items.length > 0 && withoutPhoto > 0 && (
        <p className="mt-4 rounded-xl bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-900">
          {withoutPhoto === 1 ? '1 item has' : `${withoutPhoto} items have`} no photo yet. Items with a photo are much
          easier to choose. Tap &ldquo;Take photo&rdquo; or &ldquo;Upload&rdquo; on an item to add one.
        </p>
      )}

      {error && !formOpen && <p className="mt-4 text-sm text-danger-600">{error}</p>}

      {formOpen && (
        <div ref={formRef}>
          <Card className="mt-6 border-primary-100">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-text">{editingId ? 'Edit item' : 'New item'}</h2>
                <button type="button" onClick={closeForm} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-50">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={save} className="flex flex-col gap-5">
                {/* Photo first: the picture is what a buyer sees before anything else. */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex aspect-square w-full max-w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-primary-50">
                    {shownImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shownImage} alt="Item photo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-text-secondary">
                        <ImagePlus className="h-8 w-8 text-primary-600" />
                        Start with a photo of the item
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <PhotoUploadButtons idPrefix="catalog-form" onFile={onPhoto} disabled={drafting || busy} busyLabel={drafting ? 'Reading photo…' : undefined} />
                    <p className="max-w-sm text-sm text-text-secondary">
                      Hold the phone steady, fill the picture with the item, and use daylight. The photo helper then
                      suggests the name and description for you to check.
                    </p>
                    {drafting && (
                      <p className="flex items-center gap-2 text-sm font-semibold text-primary-600">
                        <Sparkles className="h-4 w-4" />
                        Looking at your photo…
                      </p>
                    )}
                    {aiNote && !drafting && <p className="text-sm font-semibold text-primary-600">{aiNote}</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-name">Item name</Label>
                  <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Walking stick" maxLength={160} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="c-price">Price (₹)</Label>
                    <Input id="c-price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="499" inputMode="decimal" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="c-category">Category (optional)</Label>
                    <Input id="c-category" list="c-category-list" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Mobility aids" maxLength={60} />
                    <datalist id="c-category-list">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="c-weight">Weight of one, in kg (optional)</Label>
                    <Input id="c-weight" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} placeholder="0.5" inputMode="decimal" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="c-size">Parcel size (optional)</Label>
                    <select
                      id="c-size"
                      value={form.parcelSize}
                      onChange={(e) => setForm((f) => ({ ...f, parcelSize: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    >
                      <option value="">Not set (small)</option>
                      <option value="small">Small (fits in a bag)</option>
                      <option value="medium">Medium (a carton)</option>
                      <option value="large">Large (both hands or a vehicle)</option>
                    </select>
                  </div>
                  <p className="text-xs text-text-secondary sm:col-span-2">Used to work out the EC delivery charge.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-desc">Description (optional)</Label>
                  <textarea
                    id="c-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Adjustable height, non-slip base"
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                </div>
                {error && <p className="text-sm text-danger-600">{error}</p>}
                <div className="flex gap-3">
                  <Button type="submit" disabled={busy || drafting}>
                    {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to catalog'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeForm} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-text-secondary">
              <Package className="h-8 w-8 text-primary-600" />
              No catalog items yet. Tap &ldquo;Add item with a photo&rdquo; to list your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="relative aspect-square w-full bg-primary-50">
                  {item.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imagePath} alt={item.name} loading="lazy" className={`h-full w-full object-cover ${item.inStock ? '' : 'opacity-50'}`} />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-xs font-semibold text-text-secondary">
                      <Package className="h-8 w-8 text-primary-600" />
                      No photo yet
                    </div>
                  )}
                  {!item.inStock && (
                    <Badge variant="danger" className="absolute left-2 top-2">
                      Out of stock
                    </Badge>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-text">{item.name}</p>
                  <p className="text-base font-bold text-primary-900">₹{Number(item.price).toLocaleString('en-IN')}</p>
                  {item.category && <Badge variant="muted" className="w-fit">{item.category}</Badge>}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <PhotoUploadButtons
                      idPrefix={`catalog-${item.id}`}
                      disabled={uploadingId === item.id}
                      busyLabel={uploadingId === item.id ? 'Uploading…' : undefined}
                      onFile={(e) => replacePhoto(item.id, e)}
                    />
                    <Button size="sm" variant="outline" onClick={() => toggleStock(item)}>
                      {item.inStock ? 'Mark out of stock' : 'Mark in stock'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-danger-600" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
