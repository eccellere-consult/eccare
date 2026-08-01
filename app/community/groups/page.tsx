'use client';

import { useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteUrl: string;
}
interface Me { memberships: { role: string }[] }

export default function WhatsAppGroupsPage() {
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
      setFormError(err instanceof Error ? err.message : 'Could not add group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Community WhatsApp groups"
      subtitle="Tap to open WhatsApp and join."
      action={
        canPost ? (
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add group'}</Button>
        ) : undefined
      }
      loading={loading}
      error={error}
      isEmpty={!showForm && (data?.length ?? 0) === 0}
      emptyMessage="Your committee hasn't added any groups yet."
    >
      <div className="flex flex-col gap-3">
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={create} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Block A Residents" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-description">Description (optional)</Label>
                  <Input id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-url">Invite link</Label>
                  <Input
                    id="group-url"
                    value={inviteUrl}
                    onChange={(e) => setInviteUrl(e.target.value)}
                    placeholder="https://chat.whatsapp.com/…"
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !name.trim() || !inviteUrl.trim()}>
                  {busy ? 'Adding…' : 'Add group'}
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
