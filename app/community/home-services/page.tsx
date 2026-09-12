'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Wrench, BadgeCheck, UserPlus, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

type HomeCategory = 'leakage' | 'cleaning' | 'maid' | 'cook' | 'painting' | 'gardening' | 'electrical' | 'carpentry' | 'other';

const CATEGORIES: { key: HomeCategory; labelKey: TranslationKey }[] = [
  { key: 'leakage', labelKey: 'community.homeServices.categoryLeakage' },
  { key: 'cleaning', labelKey: 'community.homeServices.categoryCleaning' },
  { key: 'maid', labelKey: 'community.homeServices.categoryMaid' },
  { key: 'cook', labelKey: 'community.homeServices.categoryCook' },
  { key: 'painting', labelKey: 'community.homeServices.categoryPainting' },
  { key: 'gardening', labelKey: 'community.homeServices.categoryGardening' },
  { key: 'electrical', labelKey: 'community.homeServices.categoryElectrical' },
  { key: 'carpentry', labelKey: 'community.homeServices.categoryCarpentry' },
  { key: 'other', labelKey: 'community.homeServices.categoryOther' },
];

interface Vendor {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  verified: boolean;
  homeMaintenanceCategory: HomeCategory | null;
}
interface Me { memberships: { role: 'member' | 'committee' | 'admin' }[] }

export default function HomeServicesPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  // Explicit param (even empty) is what the server now uses to disambiguate this
  // view from the plain Vendors list — see app/api/v1/community/vendors/route.ts.
  const { data, loading, error, reload } = useCommunityData<Vendor[]>('/community/vendors?homeMaintenanceCategory=');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role === 'committee' || me?.memberships?.[0]?.role === 'admin';

  const [myRole, setMyRole] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMyRole(j.data.role); })
      .catch(() => {});
  }, []);
  const contactsHref = myRole === 'elder' ? '/elder/contacts' : '/family/contacts';

  const [activeCategory, setActiveCategory] = useState<HomeCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'leakage' as HomeCategory, phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const filtered = (data ?? []).filter((v) => v.homeMaintenanceCategory && (!activeCategory || v.homeMaintenanceCategory === activeCategory));
  // Split into two easy-to-scan sections: committee/admin-curated listings the
  // community can trust outright, and ones a resident suggested via their own
  // Contacts (see contact-form.tsx) — unverified, but still worth surfacing
  // rather than burying in the general Vendors directory where this category
  // tag isn't visible at all.
  const verifiedListings = filtered.filter((v) => v.verified);
  const suggestedListings = filtered.filter((v) => !v.verified);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/vendors', {
        name: form.name,
        // Stored as the canonical English label regardless of the committee
        // member's own display language right now — this becomes the vendor's
        // permanent category text shown to every future viewer.
        category: translate(CATEGORIES.find((c) => c.key === form.category)?.labelKey ?? 'community.homeServices.categoryOther', 'en'),
        homeMaintenanceCategory: form.category,
        phone: form.phone,
        address: form.address || undefined,
      });
      setForm({ name: '', category: 'leakage', phone: '', address: '' });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.homeServices.couldNotAdd'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.homeServices.title')}
      subtitle={t('community.homeServices.subtitle')}
      action={canManage ? <Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.homeServices.addProvider')}</Button> : undefined}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === null ? 'primary' : 'outline'} onClick={() => setActiveCategory(null)}>
            {t('common.all')}
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={activeCategory === c.key ? 'primary' : 'outline'}
              onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            >
              {t(c.labelKey)}
            </Button>
          ))}
        </div>

        {!canManage && (
          <Link href={contactsHref}>
            <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
                  <UserPlus className="h-5 w-5 text-accent-600" />
                </span>
                <div className="flex-1">
                  <p className="font-bold text-text">{t('community.homeServices.knowProvider')}</p>
                  <p className="text-sm text-text-secondary">{t('community.homeServices.addToContacts')}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
              </CardContent>
            </Card>
          </Link>
        )}

        {showForm && canManage && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-category">{t('community.homeServices.category')}</Label>
                  <select
                    id="hs-category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as HomeCategory }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{t(c.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-name">{t('community.homeServices.name')}</Label>
                  <Input id="hs-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('community.homeServices.namePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-phone">{t('community.homeServices.phoneNumber')}</Label>
                  <Input id="hs-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t('community.homeServices.phonePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hs-address">{t('community.homeServices.addressOptional')}</Label>
                  <Input id="hs-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder={t('community.homeServices.addressPlaceholder')} />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !form.name || !form.phone} className="self-start">
                  {busy ? t('community.homeServices.adding') : t('community.homeServices.add')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              {t('community.homeServices.noProviders')}
            </CardContent>
          </Card>
        ) : (
          <>
            {verifiedListings.length > 0 && (
              <div>
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-text-secondary">
                  <BadgeCheck className="h-4 w-4 text-success-600" /> {t('community.homeServices.registeredByCommunity')}
                </h2>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {verifiedListings.map((v) => (
                    <VendorCard key={v.id} vendor={v} t={t} />
                  ))}
                </div>
              </div>
            )}

            {suggestedListings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-text-secondary">{t('community.homeServices.suggestedByResidents')}</h2>
                <p className="text-xs text-text-secondary">{t('community.homeServices.notYetVerified')}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {suggestedListings.map((v) => (
                    <VendorCard key={v.id} vendor={v} t={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CommunityPageFrame>
  );
}

function VendorCard({ vendor: v, t }: { vendor: Vendor; t: (key: TranslationKey) => string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <Wrench className="h-5 w-5 text-primary-600" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/community/vendors/${v.id}`} className="flex items-center gap-1.5 font-bold text-text hover:underline">
            <span className="truncate">{v.name}</span>
            {v.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-600" />}
          </Link>
          <div className="mt-0.5">
            <Badge variant="muted">{t(CATEGORIES.find((c) => c.key === v.homeMaintenanceCategory)?.labelKey ?? 'community.homeServices.categoryOther')}</Badge>
          </div>
          {v.address && <p className="mt-1 truncate text-sm text-text-secondary">{v.address}</p>}
          <Link href={`/community/vendors/${v.id}`} className="mt-1 inline-block text-xs font-semibold text-primary-600 hover:underline">
            {t('community.homeServices.raiseRequest')}
          </Link>
        </div>
        <a
          href={`tel:${v.phone}`}
          aria-label={`Call ${v.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
        >
          <Phone className="h-5 w-5" />
        </a>
      </CardContent>
    </Card>
  );
}
