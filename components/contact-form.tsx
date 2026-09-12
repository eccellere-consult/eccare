'use client';

import { useState } from 'react';
import { Contact as ContactIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isContactPickerSupported, pickContact } from '@/lib/contact-picker';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

type FormCategory = 'neighbor' | 'friend' | 'serviceProvider' | 'emergencyContact' | 'hospital' | 'other';

const CATEGORY_OPTIONS: { value: FormCategory; labelKey: TranslationKey }[] = [
  { value: 'neighbor', labelKey: 'shared.contactForm.category.neighbor' },
  { value: 'friend', labelKey: 'shared.contactForm.category.friend' },
  { value: 'serviceProvider', labelKey: 'shared.contactForm.category.serviceProvider' },
  { value: 'emergencyContact', labelKey: 'shared.contactForm.category.emergencyContact' },
  { value: 'hospital', labelKey: 'shared.contactForm.category.hospital' },
  { value: 'other', labelKey: 'shared.contactForm.category.other' },
];

type HomeMaintenanceCategory =
  | 'leakage' | 'cleaning' | 'maid' | 'cook' | 'painting' | 'gardening' | 'electrical' | 'carpentry' | 'other';

const HOME_MAINTENANCE_OPTIONS: { value: HomeMaintenanceCategory; labelKey: TranslationKey }[] = [
  { value: 'leakage', labelKey: 'shared.contactForm.home.leakage' },
  { value: 'cleaning', labelKey: 'shared.contactForm.home.cleaning' },
  { value: 'maid', labelKey: 'shared.contactForm.home.maid' },
  { value: 'cook', labelKey: 'shared.contactForm.home.cook' },
  { value: 'painting', labelKey: 'shared.contactForm.home.painting' },
  { value: 'gardening', labelKey: 'shared.contactForm.home.gardening' },
  { value: 'electrical', labelKey: 'shared.contactForm.home.electrical' },
  { value: 'carpentry', labelKey: 'shared.contactForm.home.carpentry' },
  { value: 'other', labelKey: 'shared.contactForm.home.other' },
];

export function ContactForm({
  elderUserId,
  inCommunity,
  onAdded,
  onCancel,
}: {
  elderUserId: string;
  inCommunity: boolean;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<FormCategory>('neighbor');
  const [providerType, setProviderType] = useState('');
  const [homeMaintenanceCategory, setHomeMaintenanceCategory] = useState<HomeMaintenanceCategory | ''>('');
  const [relationship, setRelationship] = useState('');
  const [shareWithCommunity, setShareWithCommunity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickerSupported = isContactPickerSupported();

  async function handlePick() {
    const picked = await pickContact();
    if (picked) {
      setName(picked.name);
      setPhone(picked.phone);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError(t('shared.contactForm.enterNamePhone'));
      return;
    }
    if (category === 'emergencyContact' && !relationship.trim()) {
      setError(t('shared.contactForm.enterRelationship'));
      return;
    }

    setBusy(true);
    try {
      const endpoint = category === 'emergencyContact' ? '/api/v1/emergency/contacts' : '/api/v1/contacts';
      const body =
        category === 'emergencyContact'
          ? { elderUserId, name, phone, relationship }
          : {
              elderUserId,
              name,
              phone,
              category,
              providerType: category === 'serviceProvider' ? providerType || undefined : undefined,
              homeMaintenanceCategory:
                category === 'serviceProvider' && shareWithCommunity && homeMaintenanceCategory
                  ? homeMaintenanceCategory
                  : undefined,
              shareWithCommunity: shareWithCommunity || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('shared.contactForm.couldNotAdd'));

      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shared.contactForm.couldNotAdd'));
    } finally {
      setBusy(false);
    }
  }

  const canShare = inCommunity && (category === 'serviceProvider' || category === 'hospital' || category === 'neighbor');
  const shareLabel = category === 'neighbor' ? t('shared.contactForm.shareNeighbor') : t('shared.contactForm.shareVendor');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {pickerSupported && (
          <Button type="button" variant="outline" onClick={handlePick} className="self-start">
            <ContactIcon className="h-4 w-4" />
            {t('shared.contactForm.pickFromContacts')}
          </Button>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-name">{t('shared.contactForm.name')}</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('shared.contactForm.namePlaceholder')} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-phone">{t('shared.contactForm.phoneNumber')}</Label>
            <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('shared.contactForm.phonePlaceholder')} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-category">{t('shared.contactForm.category')}</Label>
            <select
              id="contact-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FormCategory)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {category === 'serviceProvider' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-provider-type">{t('shared.contactForm.whatKindOfService')}</Label>
              <Input
                id="contact-provider-type"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                placeholder={t('shared.contactForm.serviceTypePlaceholder')}
              />
            </div>
          )}

          {category === 'emergencyContact' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-relationship">{t('shared.contactForm.relationship')}</Label>
              <Input
                id="contact-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder={t('shared.contactForm.relationshipPlaceholder')}
              />
              <p className="text-xs text-text-secondary">
                {t('shared.contactForm.emergencyHelper')}
              </p>
            </div>
          )}

          {canShare && (
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={shareWithCommunity}
                onChange={(e) => setShareWithCommunity(e.target.checked)}
                className="h-5 w-5 rounded border-border"
              />
              {shareLabel}
            </label>
          )}

          {category === 'serviceProvider' && shareWithCommunity && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-home-category">{t('shared.contactForm.homeServiceOptional')}</Label>
              <select
                id="contact-home-category"
                value={homeMaintenanceCategory}
                onChange={(e) => setHomeMaintenanceCategory(e.target.value as HomeMaintenanceCategory | '')}
                className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
              >
                <option value="">{t('shared.contactForm.notHomeService')}</option>
                {HOME_MAINTENANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
              <p className="text-xs text-text-secondary">
                {t('shared.contactForm.homeServiceHelper')}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? t('shared.contactForm.adding') : t('shared.contactForm.addContact')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('shared.contactForm.cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
