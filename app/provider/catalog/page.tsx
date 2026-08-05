'use client';

import { useEffect, useState } from 'react';
import { Package, Upload, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imagePath: string | null;
  category: string | null;
  inStock: boolean;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

const EMPTY_FORM = { name: '', description: '', price: '', category: '' };

export default function ProviderCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price <= 0) {
      setError('Please enter a name and a valid price.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/provider/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          price,
          category: form.category || undefined,
        }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.');
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

  async function uploadImage(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const body = new FormData();
      body.append('file', file);
      await api(`/provider/catalog/${id}/image`, { method: 'POST', body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload image.');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Your catalog</h1>
          <p className="mt-1 text-text-secondary">Items elders and family can browse and buy.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add item'}</Button>
      </div>

      {showForm && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={create} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-name">Item name</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Walking stick" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-price">Price (₹)</Label>
                  <Input id="c-price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="499" inputMode="decimal" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-category">Category (optional)</Label>
                  <Input id="c-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Mobility aids" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-desc">Description (optional)</Label>
                <Input id="c-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Adjustable height, non-slip base" />
              </div>
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? 'Adding…' : 'Add item'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
              <Package className="h-8 w-8 text-primary-600" />
              No catalog items yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex gap-4 pt-6">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50">
                    {item.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imagePath} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-primary-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-text">{item.name}</p>
                    <p className="text-sm font-semibold text-primary-900">₹{item.price}</p>
                    {item.category && <Badge variant="muted" className="mt-1">{item.category}</Badge>}
                    {!item.inStock && <Badge variant="danger" className="ml-1 mt-1">Out of stock</Badge>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingId === item.id ? 'Uploading…' : 'Photo'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          disabled={uploadingId === item.id}
                          onChange={(e) => uploadImage(item.id, e)}
                        />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => toggleStock(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {item.inStock ? 'Mark out of stock' : 'Mark in stock'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger-600" onClick={() => remove(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
