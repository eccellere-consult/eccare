'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Phone, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: vendors } = useCommunityData<Vendor[]>('/community/vendors');
  const vendor = vendors?.find((v) => v.id === id);
  const { data: catalog, loading } = useCommunityData<CatalogResponse>(`/community/vendors/${id}/catalog`);
  const cart = useCart();

  return (
    <div>
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
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-primary-50"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        </div>
      )}

      {cart.providerId && cart.items.length > 0 && (
        <Card className="mt-6 border-primary-100 bg-primary-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="flex items-center gap-2 font-semibold text-primary-900">
              <ShoppingCart className="h-4 w-4" />
              {cart.items.reduce((n, i) => n + i.quantity, 0)} item(s) in cart from {cart.providerName} · ₹{cart.total.toFixed(2)}
            </p>
            {cart.providerId === catalog?.providerId && (
              <Button asChild size="sm">
                <Link href={`/community/vendors/${id}/checkout`}>Checkout</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : !catalog || catalog.items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-text-secondary">
              <Package className="h-8 w-8 text-primary-600" />
              This vendor hasn&rsquo;t listed any items yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.items.map((item) => (
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
                    {item.description && <p className="mt-1 truncate text-sm text-text-secondary">{item.description}</p>}
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        catalog.providerId &&
                        cart.addItem(catalog.providerId, catalog.listingName, id, {
                          catalogItemId: item.id,
                          name: item.name,
                          price: Number(item.price),
                          imagePath: item.imagePath,
                        })
                      }
                    >
                      Add to cart
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
