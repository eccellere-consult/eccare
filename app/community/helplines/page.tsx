'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Helpline {
  id: string;
  label: string;
  phone: string;
  category: string;
}
interface Me { memberships: { role: string }[] }

export default function HelplinesPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data, loading, error, reload } = useCommunityData<Helpline[]>('/community/helplines');
  const canPost = me?.memberships?.[0]?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/helplines', { label, phone, category: category || undefined });
      setLabel('');
      setPhone('');
      setCategory('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.helplines.couldNotAdd'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.helplines.title')}
      subtitle={t('community.helplines.subtitle')}
      action={
        canPost ? (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.helplines.addHelpline')}</Button>
        ) : undefined
      }
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage={t('community.helplines.noHelplines')}
    >
      <div className="flex flex-col gap-3">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-label">{t('community.helplines.name')}</Label>
                  <Input id="helpline-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('community.helplines.namePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-phone">{t('community.helplines.phoneNumber')}</Label>
                  <Input id="helpline-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('community.helplines.phonePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="helpline-category">{t('community.helplines.categoryOptional')}</Label>
                  <Input id="helpline-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('community.helplines.categoryPlaceholder')} />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !label.trim() || !phone.trim()}>
                  {busy ? t('community.helplines.adding') : t('community.helplines.addHelpline')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((h) => (
          // A plain tel: link rather than a JS handler — it works on every device and
          // needs no permission, which matters most for the emergency case.
          <a key={h.id} href={`tel:${h.phone}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-50">
                  <Phone className="h-5 w-5 text-danger-600" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold text-text">{h.label}</span>
                  <span className="block text-text-secondary">{h.phone}</span>
                </span>
                <span className="rounded-xl bg-danger-600 px-4 py-2 font-semibold text-white">{t('common.call')}</span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
