'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Star, ShieldCheck, HeartHandshake, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ElderCareCategory = 'home_treatment' | 'home_nursing' | 'companion_service' | 'local_errands' | 'other';

interface Provider {
  id: string;
  businessName: string;
  elderCareCategory: ElderCareCategory;
  description: string | null;
  serviceArea: string | null;
  phone: string | null;
  address: string | null;
  isFeatured: boolean;
}

// Crowdsourced community vendors a committee/admin has tagged as elder care —
// distinct from the platform-wide ServiceProvider list above (see
// app/api/v1/community/vendors/route.ts). Mirrors the mobile app's
// "From Your Community" section on the Elder Care screen, which this page
// was missing.
interface CommunityVendor {
  id: string;
  name: string;
  elderCareCategory: ElderCareCategory;
  description: string | null;
  address: string | null;
  phone: string;
  verified: boolean;
}

const CATEGORIES: { key: ElderCareCategory; label: string; icon: LucideIcon }[] = [
  { key: 'home_treatment', label: 'Home treatment', icon: HeartHandshake },
  { key: 'home_nursing', label: 'Home nursing', icon: HeartHandshake },
  { key: 'companion_service', label: 'Companion service', icon: HeartHandshake },
  { key: 'local_errands', label: 'Local errands', icon: HeartHandshake },
  { key: 'other', label: 'Other', icon: HeartHandshake },
];

export default function ElderCareServicesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ElderCareCategory | null>(null);

  const [communityVendors, setCommunityVendors] = useState<CommunityVendor[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    fetch(`/api/v1/services/elder-care?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setProviders(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => { load(); }, [load]);

  // Hidden entirely when the caller isn't in a community yet, or the community
  // hasn't tagged any vendor as elder care — same "never show an empty section"
  // behavior as the mobile app's equivalent section.
  useEffect(() => {
    fetch('/api/v1/community/vendors?elderCareCategory=', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setCommunityVendors(j.data); })
      .catch(() => {});
  }, []);

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Services
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Elder Care Services</h1>
      <p className="mt-1 text-text-secondary">
        Home treatment, home nursing, companion service, and local errands from verified providers.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
          All
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c.key}
            size="sm"
            variant={activeCategory === c.key ? 'primary' : 'outline'}
            onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : providers.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-text-secondary">
            No providers listed yet. Check back soon!
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {providers.map((p) => {
            const catMeta = CATEGORIES.find((c) => c.key === p.elderCareCategory);
            return (
              <Card key={p.id} className={p.isFeatured ? 'border-accent-200' : undefined}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <HeartHandshake className="h-5 w-5 text-primary-600" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-text">{p.businessName}</p>
                        <p className="text-xs text-text-secondary">{catMeta?.label}</p>
                      </div>
                    </div>
                    {p.isFeatured && (
                      <Badge variant="accent" className="shrink-0">
                        <Star className="mr-1 h-3 w-3" />
                        Featured
                      </Badge>
                    )}
                  </div>

                  {p.description && <p className="mt-3 text-sm text-text-secondary">{p.description}</p>}

                  <div className="mt-3 flex flex-col gap-1.5">
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {p.phone}
                      </a>
                    )}
                    {(p.address || p.serviceArea) && (
                      <p className="flex items-center gap-2 text-sm text-text-secondary">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[p.address, p.serviceArea].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {communityVendors.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-text">From Your Community</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Vendors your residents&apos; association has tagged as elder care.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {communityVendors.map((v) => {
              const catMeta = CATEGORIES.find((c) => c.key === v.elderCareCategory);
              return (
                <Card key={v.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                          <HeartHandshake className="h-5 w-5 text-primary-600" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-text">{v.name}</p>
                          <p className="text-xs text-text-secondary">{catMeta?.label}</p>
                        </div>
                      </div>
                      {v.verified && (
                        <Badge variant="success" className="shrink-0">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    {v.description && <p className="mt-3 text-sm text-text-secondary">{v.description}</p>}

                    <div className="mt-3 flex flex-col gap-1.5">
                      <a href={`tel:${v.phone}`} className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {v.phone}
                      </a>
                      {v.address && (
                        <p className="flex items-center gap-2 text-sm text-text-secondary">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {v.address}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
