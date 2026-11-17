'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Minus, Package, Phone, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCommunityData } from '@/lib/community-client';
import { useCart } from '@/components/cart-context';

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string | null;
  verified: boolean;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imagePath: string | null;
  category: string | null;
}

interface CatalogResponse {
  listingName: string;
  providerId?: string;
  items: CatalogItem[];
}

const rupees = (value: string | number) => `₹${Number(value).toLocaleString('en-IN')}`;

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: vendors } = useCommunityData<Vendor[]>('/community/vendors');
  const vendor = vendors?.find((v) => v.id === id);
  const { data: catalog, loading } = useCommunityData<CatalogResponse>(`/community/vendors/${id}/catalog`);
  const cart = useCart();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<CatalogItem | null>(null);

  const items = useMemo(() => catalog?.items ?? [], [catalog]);
  const providerId = catalog?.providerId;
  const cartIsHere = Boolean(providerId) && cart.providerId === providerId;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.category) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!category || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)),
    );
  }, [items, query, category]);

  const quantityOf = (itemId: string) => (cartIsHere ? cart.items.find((c) => c.catalogItemId === itemId)?.quantity ?? 0 : 0);
  const cartCount = cartIsHere ? cart.items.reduce((n, i) => n + i.quantity, 0) : 0;

  function add(item: CatalogItem) {
    if (!providerId || !catalog) return;
    cart.addItem(providerId, catalog.listingName, id, {
      catalogItemId: item.id,
      name: item.name,
      price: Number(item.price),
      imagePath: item.imagePath,
    });
  }

  // Escape closes the detail view.
  useEffect(() => {
    if (!openItem) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenItem(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openItem]);

  /** "Add" until it is in the cart, then a - 1 + stepper, big enough for an elder's thumb. */
  function renderBuy(item: CatalogItem, large?: boolean) {
    const qty = quantityOf(item.id);
    const size = large ? 'h-12 w-12' : 'h-11 w-11';
    if (qty === 0) {
      return (
        <Button size={large ? 'lg' : 'default'} className="w-full" onClick={() => add(item)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      );
    }
    return (
      <div className="flex w-full items-center justify-between rounded-xl border border-primary-600 bg-primary-50">
        <button type="button" aria-label={`One less ${item.name}`} onClick={() => cart.updateQuantity(item.id, qty - 1)} className={`flex ${size} items-center justify-center text-primary-600`}>
          <Minus className="h-5 w-5" />
        </button>
        <span className="text-base font-bold text-primary-900" aria-live="polite">
          {qty}
        </span>
        <button type="button" aria-label={`One more ${item.name}`} onClick={() => add(item)} className={`flex ${size} items-center justify-center text-primary-600`}>
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cartCount > 0 ? 'pb-48' : ''}>
      <Link
        href="/community/vendors"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Vendors
      </Link>

      {vendor && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">{vendor.name}</h1>
            <p className="mt-1 text-text-secondary">
              {vendor.category}
              {vendor.address ? ` · ${vendor.address}` : ''}
            </p>
          </div>
          <a
            href={`tel:${vendor.phone}`}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-primary-50"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search this shop</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${items.length} item${items.length === 1 ? '' : 's'}`}
              className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            />
          </label>
          {categories.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Categories">
              {[{ name: null as string | null, label: `All (${items.length})` }, ...categories.map(([name, n]) => ({ name, label: `${name} (${n})` }))].map((c) => {
                const active = category === c.name;
                return (
                  <button
                    key={c.name ?? 'all'}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(c.name)}
                    className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                      active ? 'border-primary-600 bg-primary-600 text-white' : 'border-border bg-surface text-text hover:bg-primary-50'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="aspect-[3/4] animate-pulse rounded-2xl bg-border" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
              <Package className="h-8 w-8 text-primary-600" />
              This vendor hasn&rsquo;t listed any items yet.
            </CardContent>
          </Card>
        ) : shown.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-text-secondary">
              Nothing matches that. Try a shorter word, or clear the filters.
              <Button variant="outline" onClick={() => { setQuery(''); setCategory(null); }}>
                Show everything
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((item) => (
              <Card key={item.id} className="flex flex-col overflow-hidden">
                <button type="button" onClick={() => setOpenItem(item)} className="block text-left" aria-label={`Details of ${item.name}`}>
                  <div className="aspect-square w-full bg-primary-50">
                    {item.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imagePath} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-10 w-10 text-primary-600" />
                      </div>
                    )}
                  </div>
                  <div className="px-3 pt-3">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-text">{item.name}</p>
                    <p className="mt-1 text-lg font-bold text-primary-900">{rupees(item.price)}</p>
                  </div>
                </button>
                <div className="mt-auto p-3 pt-2">
                  {renderBuy(item)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {openItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={openItem.name}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setOpenItem(null)}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-square max-h-[40vh] w-full bg-primary-50 sm:max-h-none">
              {openItem.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={openItem.imagePath} alt={openItem.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-primary-600" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpenItem(null)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface/90 text-text shadow"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              {openItem.category && <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{openItem.category}</p>}
              <h2 className="text-xl font-bold text-text">{openItem.name}</h2>
              <p className="text-2xl font-bold text-primary-900">{rupees(openItem.price)}</p>
              {openItem.description && <p className="whitespace-pre-line text-base text-text">{openItem.description}</p>}
              {renderBuy(openItem, true)}
            </div>
          </div>
        </div>
      )}

      {cartCount > 0 && (
        // Floats above the "Ask Arya" helper (fixed bottom-right) so Checkout is never covered by it.
        <div className="fixed inset-x-4 bottom-[10.75rem] z-30 mx-auto max-w-md rounded-2xl border border-border bg-surface px-4 py-3 shadow-[0_8px_24px_rgba(5,46,54,0.18)] md:bottom-[7.5rem]">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-primary-900">
              <ShoppingCart className="h-5 w-5 shrink-0" />
              <span className="truncate">
                {cartCount} item{cartCount === 1 ? '' : 's'} · {rupees(cart.total)}
              </span>
            </p>
            <Button asChild size="lg">
              <Link href={`/community/vendors/${id}/checkout`}>Checkout</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
