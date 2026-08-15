'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Heart,
  HandHeart,
  Activity,
  Flower2,
  Brain,
  Phone,
  Globe,
  MapPin,
  BadgeCheck,
  Search,
  Stethoscope,
  Leaf,
  Building2,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Listing {
  id: string;
  name: string;
  category: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  contactName: string | null;
  verified: boolean;
}

interface CategoryMeta {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'doctor_home_visit', label: 'Doctors (home visit)', description: 'Doctors available to visit at home', icon: Stethoscope },
  { key: 'ayurveda', label: 'Ayurveda', description: 'Traditional Ayurvedic practitioners', icon: Leaf },
  { key: 'hospital', label: 'Hospitals', description: 'Elder-care-focused hospitals nearby', icon: Building2 },
  { key: 'ambulance', label: 'Ambulance', description: 'Elder-care ambulance and transport services', icon: Siren },
  { key: 'self_help_group', label: 'Self-help groups', description: 'Peer support and shared wellness circles', icon: Users },
  { key: 'ngo', label: 'NGOs & local groups', description: 'Non-profits working for elder welfare', icon: HandHeart },
  { key: 'palliative_care', label: 'Palliative care', description: 'Comfort-focused care and support', icon: Heart },
  { key: 'physiotherapy', label: 'Physiotherapy', description: 'Physical rehabilitation and mobility', icon: Activity },
  { key: 'massage', label: 'Massage therapy', description: 'Therapeutic massage for pain and relaxation', icon: Flower2 },
  { key: 'yoga', label: 'Yoga', description: 'Yoga classes and practitioners', icon: Flower2 },
  { key: 'meditation', label: 'Meditation', description: 'Guided meditation and mindfulness', icon: Brain },
];

export default function GeriatricCarePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    fetch(`/api/v1/geriatric-care?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setListings(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => { load(); }, [load]);

  const filtered = searchTerm
    ? listings.filter((l) =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.city?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : listings;

  const activeMeta = CATEGORIES.find((c) => c.key === activeCategory);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Geriatrics care</h1>
      <p className="mt-1 text-text-secondary">
        Find support groups, therapists, and wellness services for seniors.
      </p>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeCategory === null ? 'primary' : 'outline'}
          onClick={() => setActiveCategory(null)}
        >
          All
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            size="sm"
            variant={activeCategory === cat.key ? 'primary' : 'outline'}
            onClick={() => setActiveCategory(cat.key === activeCategory ? null : cat.key)}
          >
            <cat.icon className="mr-1.5 h-4 w-4" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search by name, city, or description…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-text placeholder:text-text-secondary focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
        />
      </div>

      {activeMeta && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3">
          <activeMeta.icon className="h-5 w-5 text-primary-600" />
          <div>
            <p className="font-semibold text-primary-900">{activeMeta.label}</p>
            <p className="text-sm text-primary-600">{activeMeta.description}</p>
          </div>
        </div>
      )}

      {/* Listings */}
      {loading ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-text-secondary">
            {searchTerm ? 'No results match your search.' : 'No listings yet. Check back soon!'}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((listing) => {
            const catMeta = CATEGORIES.find((c) => c.key === listing.category);
            const CatIcon = catMeta?.icon ?? Heart;
            return (
              <Card key={listing.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <CatIcon className="h-5 w-5 text-primary-600" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-text">{listing.name}</p>
                        <p className="text-xs text-text-secondary">{catMeta?.label}</p>
                      </div>
                    </div>
                    {listing.verified && (
                      <Badge variant="success" className="shrink-0">
                        <BadgeCheck className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>

                  {listing.description && (
                    <p className="mt-3 text-sm text-text-secondary">{listing.description}</p>
                  )}

                  <div className="mt-3 flex flex-col gap-1.5">
                    {listing.phone && (
                      <a
                        href={`tel:${listing.phone}`}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {listing.phone}
                      </a>
                    )}
                    {listing.website && (
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Visit website
                      </a>
                    )}
                    {(listing.address || listing.city) && (
                      <p className="flex items-center gap-2 text-sm text-text-secondary">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[listing.address, listing.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {listing.contactName && (
                      <p className="text-xs text-text-secondary">
                        Contact: {listing.contactName}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
