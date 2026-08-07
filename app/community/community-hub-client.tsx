'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  Phone,
  Store,
  MessageSquareWarning,
  Megaphone,
  MessagesSquare,
  LifeBuoy,
  Settings,
  ShieldAlert,
  UserCog,
  IndianRupee,
  Tag,
  Briefcase,
  Wrench,
  FileText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Membership {
  role: 'member' | 'committee' | 'admin';
  flatNumber: string | null;
  neighborhood: { id: string; name: string; city: string | null; joinCode: string };
}
interface MeResponse {
  memberships: Membership[];
  primaryNeighborhoodId: string | null;
}

const BASE_TILES: { href: string; label: string; sub: string; icon: LucideIcon }[] = [
  { href: '/community/announcements', label: 'Announcements', sub: 'Notices from the committee', icon: Megaphone },
  { href: '/community/events', label: 'Events', sub: "What's happening nearby", icon: Calendar },
  { href: '/community/directory', label: 'Neighbours', sub: 'Say hello or call', icon: Users },
  { href: '/community/helplines', label: 'Helplines', sub: 'Emergency numbers', icon: Phone },
  { href: '/community/vendors', label: 'Vendors', sub: 'Trusted local services', icon: Store },
  { href: '/community/home-services', label: 'Home services', sub: 'Leakage, cleaning, maid, cook & more', icon: Wrench },
  { href: '/community/queries', label: 'Committee & Help', sub: 'Raise a query', icon: MessageSquareWarning },
  { href: '/community/chat', label: 'Community Buzz', sub: 'Chat with neighbours', icon: MessagesSquare },
  { href: '/community/groups', label: 'WhatsApp groups', sub: 'Join the conversation', icon: LifeBuoy },
  { href: '/community/marketplace', label: 'Buy, sell & lend', sub: 'Old items, rentals, and things to borrow', icon: Tag },
  { href: '/community/jobs', label: 'Jobs & resources', sub: 'Offer or find local work and help', icon: Briefcase },
  { href: '/community/documents', label: 'Documents', sub: 'Bylaws, AGM minutes, notices', icon: FileText },
  { href: '/community/accounts', label: 'Accounts', sub: "What's collected and spent", icon: Wallet },
  { href: '/community/settings', label: 'Notifications', sub: 'Choose what you hear about', icon: Settings },
];

const MEMBERS_TILE = {
  href: '/community/members',
  label: 'Members',
  sub: 'Promote to committee or admin',
  icon: UserCog,
};

const FEES_TILE = {
  href: '/community/fees',
  label: 'Association fees',
  sub: 'Set up dues, see who’s paid',
  icon: IndianRupee,
};

export function CommunityHubClient() {
  const router = useRouter();
  const { data, loading } = useCommunityData<MeResponse>('/community/me');
  const [panicBusy, setPanicBusy] = useState(false);
  const [panicMsg, setPanicMsg] = useState('');

  if (loading) {
    return <p className="text-text-secondary">Loading your community…</p>;
  }

  const membership = data?.memberships?.[0];

  if (!membership) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold text-text">Join your community</h1>
        <p className="mt-2 text-text-secondary">
          Your neighbourhood shares announcements, events, trusted vendors and helpline numbers here.
          Ask your management committee for the community code.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/community/join">Enter community code</Link>
        </Button>
      </div>
    );
  }

  async function raisePanicAlert() {
    if (!confirm('Send a panic alert to your family and community committee?')) return;
    setPanicBusy(true);
    setPanicMsg('');

    const send = async (lat?: number, lng?: number) => {
      try {
        await communityApi.post('/community/panic', { lat, lng });
        setPanicMsg('Alert sent. Help has been notified.');
      } catch (err) {
        setPanicMsg(err instanceof Error ? err.message : 'Could not send alert.');
      } finally {
        setPanicBusy(false);
      }
    };

    // Location makes the alert far more useful, but must never block it — if the
    // browser denies or stalls, the alert still goes out without coordinates.
    if (!navigator.geolocation) return send();
    navigator.geolocation.getCurrentPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => send(),
      { timeout: 5000 },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-text">{membership.neighborhood.name}</h1>
          <p className="mt-1 text-text-secondary">
            {membership.neighborhood.city ? `${membership.neighborhood.city} · ` : ''}
            {membership.role === 'member' ? 'Resident' : 'Management committee'}
            {membership.flatNumber ? ` · ${membership.flatNumber}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-900">
          Code: {membership.neighborhood.joinCode}
        </span>
      </div>

      <Card className="mt-6 border-danger-100 bg-danger-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 shrink-0 text-danger-600" />
            <div>
              <p className="text-lg font-bold text-text">Panic alert</p>
              <p className="text-sm text-text-secondary">
                One tap tells your family and the committee you need help now.
              </p>
            </div>
          </div>
          <Button variant="danger" size="lg" onClick={raisePanicAlert} disabled={panicBusy}>
            {panicBusy ? 'Sending…' : 'Get help now'}
          </Button>
        </div>
        {panicMsg && <p className="mt-3 font-semibold text-danger-900">{panicMsg}</p>}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(membership.role === 'member' ? BASE_TILES : [...BASE_TILES, MEMBERS_TILE, FEES_TILE]).map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <Icon className="h-6 w-6 text-primary-600" />
              </span>
              <span>
                <span className="block font-bold text-text">{label}</span>
                <span className="block text-sm text-text-secondary">{sub}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
