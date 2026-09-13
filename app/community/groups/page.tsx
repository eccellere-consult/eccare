'use client';

import { useState } from 'react';
import { ExternalLink, MessageCircle, Pencil, Trash2 } from 'lucide-react';
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

const EMPTY_FORM = { name: '', description: '', inviteUrl: '' };

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function startEdit(g: Group) {
    setEditingId(g.id);
    setEditForm({ name: g.name, description: g.description ?? '', inviteUrl: g.inviteUrl });
    setEditError('');
  }

  async function saveEdit(id: string) {
    setEditBusy(true);
    setEditError('');
    try {
      await communityApi.patch(`/community/whatsapp-groups/${id}`, {
        name: editForm.name,
        description: editForm.description || null,
        inviteUrl: editForm.inviteUrl,
      });
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('community.groups.couldNotAdd'));
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this WhatsApp group link?')) return;
    setDeletingId(id);
    try {
      await communityApi.delete(`/community/whatsapp-groups/${id}`);
      reload();
    } finally {
      setDeletingId(null);
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

        {data?.map((g) =>
          editingId === g.id ? (
            <Card key={g.id}>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`edit-name-${g.id}`}>{t('community.groups.groupName')}</Label>
                  <Input
                    id={`edit-name-${g.id}`}
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`edit-desc-${g.id}`}>{t('community.groups.descriptionOptional')}</Label>
                  <Input
                    id={`edit-desc-${g.id}`}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`edit-url-${g.id}`}>{t('community.groups.inviteLink')}</Label>
                  <Input
                    id={`edit-url-${g.id}`}
                    value={editForm.inviteUrl}
                    onChange={(e) => setEditForm((f) => ({ ...f, inviteUrl: e.target.value }))}
                  />
                </div>
                {editError && <p className="text-sm text-danger-600">{editError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={editBusy || !editForm.name.trim() || !editForm.inviteUrl.trim()}
                    onClick={() => saveEdit(g.id)}
                  >
                    {editBusy ? t('community.groups.adding') : t('common.save')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={g.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <a href={g.inviteUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-4">
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
                </a>
                {canPost && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      aria-label={`Edit ${g.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-primary-50 hover:text-primary-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === g.id}
                      onClick={() => remove(g.id)}
                      aria-label={`Remove ${g.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </CommunityPageFrame>
  );
}
