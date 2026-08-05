'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Neighborhood {
  id: string;
  name: string;
  joinCode: string;
}

const DEFAULT_BENEFITS = [
  '✅ One-tap SOS with live location, straight to family',
  '✅ Medicine reminders that actually notify family too',
  '✅ A neighbours directory and community notices',
  '✅ Local shops, services, and doctors in one place',
].join('\n');

/** No paid WhatsApp Business API — this is a free share-intent link
 *  (wa.me), the same pattern the /services deep-link page already uses for
 *  Swiggy/Zomato/etc. The admin composes a message, opens it pre-filled in
 *  WhatsApp (their own account, their own contacts), and sends it manually. */
export default function AdminInvitePage() {
  const { data: communities } = useCommunityData<Neighborhood[]>('/community/neighborhoods');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!neighborhoodId && communities && communities.length > 0) {
      setNeighborhoodId(communities[0].id);
    }
  }, [communities, neighborhoodId]);

  const selected = communities?.find((c) => c.id === neighborhoodId);
  const registrationLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://eccare.in/login';

  const message = [
    'EC — Just Easy. 👵👴',
    '',
    "Join us on EC, a care companion app for elders and family:",
    '',
    DEFAULT_BENEFITS,
    '',
    `Register here: ${registrationLink}`,
    selected ? `Then join our community "${selected.name}" with code: ${selected.joinCode}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const waLink = phone.trim()
    ? `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">WhatsApp invite</h1>
      <p className="mt-1 text-text-secondary">
        Compose an invite with a benefits summary, the registration link, and a
        community join code — then send it yourself from your own WhatsApp.
      </p>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 pt-6">
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
    </div>
  );
}
