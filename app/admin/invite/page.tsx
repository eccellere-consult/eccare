'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Copy, Check, Smartphone, Search, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCommunityData } from '@/lib/community-client';

interface Neighborhood {
  id: string;
  name: string;
  joinCode: string;
}
interface UserRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: 'elder' | 'caregiver' | 'admin' | 'provider';
}

const DEFAULT_BENEFITS = [
  '✅ One-tap SOS with live location, straight to family',
  '✅ Medicine reminders that actually notify family too',
  '✅ A neighbours directory and community notices',
  '✅ Local shops, services, and doctors in one place',
].join('\n');

function buildDefaultMessage(registrationLink: string, community: Neighborhood | undefined) {
  return [
    'EC — Just Easy. 👵👴',
    '',
    'Hi {{name}},',
    '',
    DEFAULT_BENEFITS,
    '',
    `Register here: ${registrationLink}`,
    community ? `Then join our community "${community.name}" with code: ${community.joinCode}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** No paid WhatsApp Business API or SMS gateway — every send here is still a
 *  free share-intent link (wa.me / sms:) that opens the admin's own
 *  WhatsApp/SMS app pre-filled, and a human has to tap Send. Real automated
 *  bulk sending needs a WhatsApp Business API account and, for SMS in India,
 *  DLT registration — both real vendor/compliance decisions, not something
 *  this page can do on its own. What this bulk mode *does* remove is the
 *  manual work of typing every number and re-composing every message — it
 *  steps through the selected recipients one at a time with the message
 *  and link already prepared. */
export default function AdminInvitePage() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const { data: communities } = useCommunityData<Neighborhood[]>('/community/neighborhoods');
  const [neighborhoodId, setNeighborhoodId] = useState('');

  useEffect(() => {
    if (!neighborhoodId && communities && communities.length > 0) {
      setNeighborhoodId(communities[0].id);
    }
  }, [communities, neighborhoodId]);

  const selectedCommunity = communities?.find((c) => c.id === neighborhoodId);
  const registrationLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://eccare.in/login';

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">WhatsApp invite</h1>
      <p className="mt-1 text-text-secondary">
        Compose an invite, then send it yourself — one at a time, or step through your whole user base.
      </p>

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant={mode === 'single' ? 'primary' : 'outline'} onClick={() => setMode('single')}>Single</Button>
        <Button size="sm" variant={mode === 'bulk' ? 'primary' : 'outline'} onClick={() => setMode('bulk')}>Bulk</Button>
      </div>

      {mode === 'single' ? (
        <SingleInvite registrationLink={registrationLink} communities={communities} neighborhoodId={neighborhoodId} setNeighborhoodId={setNeighborhoodId} selectedCommunity={selectedCommunity} />
      ) : (
        <BulkInvite registrationLink={registrationLink} communities={communities} neighborhoodId={neighborhoodId} setNeighborhoodId={setNeighborhoodId} selectedCommunity={selectedCommunity} />
      )}
    </div>
  );
}

interface SharedProps {
  registrationLink: string;
  communities: Neighborhood[] | null;
  neighborhoodId: string;
  setNeighborhoodId: (id: string) => void;
  selectedCommunity: Neighborhood | undefined;
}

function CommunityPicker({ communities, neighborhoodId, setNeighborhoodId }: Pick<SharedProps, 'communities' | 'neighborhoodId' | 'setNeighborhoodId'>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="invite-community">Community to invite them to (optional)</Label>
      <select
        id="invite-community"
        value={neighborhoodId}
        onChange={(e) => setNeighborhoodId(e.target.value)}
        className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      >
        <option value="">None — just invite them to register</option>
        {communities?.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

function SingleInvite({ registrationLink, communities, neighborhoodId, setNeighborhoodId, selectedCommunity }: SharedProps) {
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const message = buildDefaultMessage(registrationLink, selectedCommunity).replace('{{name}}', 'there');
  const waLink = phone.trim()
    ? `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <CommunityPicker communities={communities} neighborhoodId={neighborhoodId} setNeighborhoodId={setNeighborhoodId} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-phone">Their phone number (optional)</Label>
          <Input
            id="invite-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210 — leave blank to pick a chat in WhatsApp yourself"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-preview">Message preview</Label>
          <textarea
            id="invite-preview"
            readOnly
            value={message}
            rows={10}
            className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="gap-2">
              <MessageCircle className="h-4 w-4" /> Share on WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={copyMessage} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy message'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkInvite({ registrationLink, communities, neighborhoodId, setNeighborhoodId, selectedCommunity }: SharedProps) {
  const { data: users, loading } = useCommunityData<UserRow[]>('/admin/users');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<UserRow[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!message) setMessage(buildDefaultMessage(registrationLink, selectedCommunity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunity]);

  const withPhone = useMemo(() => (users ?? []).filter((u) => !!u.phone), [users]);
  const withoutPhoneCount = (users?.length ?? 0) - withPhone.length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withPhone;
    return withPhone.filter((u) => u.name.toLowerCase().includes(q) || u.phone?.includes(q));
  }, [withPhone, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  function toggleAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((u) => next.delete(u.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((u) => next.add(u.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startSending() {
    const recipients = withPhone.filter((u) => selected.has(u.id));
    if (recipients.length === 0) return;
    setQueue(recipients);
    setQueueIndex(0);
  }

  function personalize(recipient: UserRow) {
    return message.replace(/\{\{name\}\}/g, recipient.name);
  }

  function markSentAndNext() {
    if (!queue) return;
    setSentIds((prev) => new Set(prev).add(queue[queueIndex].id));
    if (queueIndex < queue.length - 1) setQueueIndex((i) => i + 1);
  }

  function exitQueue() {
    setQueue(null);
    setQueueIndex(0);
  }

  if (queue) {
    const recipient = queue[queueIndex];
    const personalized = personalize(recipient);
    const waLink = `https://wa.me/${digitsOnly(recipient.phone!)}?text=${encodeURIComponent(personalized)}`;
    const smsLink = `sms:${recipient.phone}?body=${encodeURIComponent(personalized)}`;
    const isSent = sentIds.has(recipient.id);

    return (
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-secondary">
              {queueIndex + 1} of {queue.length}{isSent ? ' — marked sent' : ''}
            </p>
            <button onClick={exitQueue} aria-label="Close" className="text-text-secondary hover:text-danger-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <p className="text-lg font-bold text-text">{recipient.name}</p>
            <p className="text-sm text-text-secondary">{recipient.phone}</p>
          </div>

          <textarea
            readOnly
            value={personalized}
            rows={9}
            className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          />

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="gap-2">
                <MessageCircle className="h-4 w-4" /> Open WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={smsLink} className="gap-2">
                <Smartphone className="h-4 w-4" /> Open SMS
              </a>
            </Button>
          </div>
          <p className="text-xs text-text-secondary">
            SMS only opens an app if you&rsquo;re on a phone browser — desktop browsers have no default SMS app.
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button variant="outline" disabled={queueIndex === 0} onClick={() => setQueueIndex((i) => i - 1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={markSentAndNext} disabled={queueIndex === queue.length - 1 && isSent}>
              {queueIndex === queue.length - 1 ? 'Mark sent — done' : 'Sent — next'} <ChevronRight className="h-4 w-4" />
            </Button>
            {queueIndex < queue.length - 1 && (
              <Button variant="outline" onClick={() => setQueueIndex((i) => i + 1)}>Skip</Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 pt-6">
        <CommunityPicker communities={communities} neighborhoodId={neighborhoodId} setNeighborhoodId={setNeighborhoodId} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-message">
            Message — use <span className="font-mono">{'{{name}}'}</span> to insert each person&rsquo;s name
          </Label>
          <textarea
            id="bulk-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className="pl-9" />
          </div>
          {selected.size > 0 && <Badge variant="default">{selected.size} selected</Badge>}
        </div>

        {withoutPhoneCount > 0 && (
          <p className="text-xs text-text-secondary">{withoutPhoneCount} account{withoutPhoneCount > 1 ? 's have' : ' has'} no phone number on file and {withoutPhoneCount > 1 ? "aren't" : "isn't"} shown here.</p>
        )}

        <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-text-secondary">
                <th className="w-10 px-4 py-2">
                  <input type="checkbox" aria-label="Select all" checked={allFilteredSelected} onChange={toggleAll} className="h-4 w-4 rounded border-border" />
                </th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Phone</th>
                <th className="px-4 py-2 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">No matches.</td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <input type="checkbox" aria-label={`Select ${u.name}`} checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} className="h-4 w-4 rounded border-border" />
                    </td>
                    <td className="px-4 py-2 font-semibold text-text">{u.name}{sentIds.has(u.id) && <span className="ml-2 text-xs font-normal text-success-600">sent</span>}</td>
                    <td className="px-4 py-2 text-text-secondary">{u.phone}</td>
                    <td className="px-4 py-2"><Badge variant="muted">{u.role}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Button disabled={selected.size === 0 || !message.trim()} onClick={startSending} className="w-fit">
          <MessageCircle className="h-4 w-4" /> Start sending to {selected.size || ''} {selected.size === 1 ? 'person' : 'people'}
        </Button>
        <p className="text-xs text-text-secondary">
          Steps through each selected person one at a time — you still tap Send yourself for every message.
          Nothing here uses a paid API, so nothing sends automatically.
        </p>
      </CardContent>
    </Card>
  );
}
