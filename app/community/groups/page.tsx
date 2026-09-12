'use client';

import { useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteUrl: string;
}
interface Me { memberships: { role: string }[] }

export default function WhatsAppGroupsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data: me } = useCommunityData<Me>('/community/me');
  const { data, loading, error, reload } = useCommunityData<Group[]>('/community/whatsapp-groups');
  const canPost = me?.memberships?.[0]?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await communityApi.post('/community/whatsapp-groups', {
        name,
        description: description || undefined,
        inviteUrl,
      });
      setName('');
      setDescription('');
      setInviteUrl('');
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.groups.couldNotAdd'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.groups.title')}
      subtitle={t('community.groups.subtitle')}
      action={
        canPost ? (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.groups.addGroup')}</Button>
        ) : undefined
      }
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage={t('community.groups.noGroups')}
    >
      <div className="flex flex-col gap-3">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-name">{t('community.groups.groupName')}</Label>
                  <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('community.groups.groupNamePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-description">{t('community.groups.descriptionOptional')}</Label>
                  <Input id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-url">{t('community.groups.inviteLink')}</Label>
                  <Input
                    id="group-url"
                    value={inviteUrl}
                    onChange={(e) => setInviteUrl(e.target.value)}
                    placeholder={t('community.groups.inviteLinkPlaceholder')}
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !name.trim() || !inviteUrl.trim()}>
                  {busy ? t('community.groups.adding') : t('community.groups.addGroup')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data?.map((g) => (
          <a key={g.id} href={g.inviteUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-50">
                  <MessageCircle className="h-5 w-5 text-success-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-text">{g.name}</span>
                  {g.description && (
                    <span className="block truncate text-sm text-text-secondary">{g.description}</span>
                  )}
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-text-secondary" />
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
