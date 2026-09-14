'use client';

import { useState, useEffect } from 'react';
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
  Palette,
  Car,
  Stethoscope,
  HeartHandshake,
  Mail,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';
import { buildWaLink } from '@/lib/whatsapp';
import { buildSosMessage, openFirstAndReturnRest, type WhatsAppRecipient } from '@/lib/emergency-notify';

interface Membership {
  role: 'member' | 'committee' | 'admin';
  flatNumber: string | null;
  neighborhood: { id: string; name: string; city: string | null; joinCode: string };
}
interface PendingMembership {
  neighborhoodId: string;
  neighborhood: { name: string };
}
interface MeResponse {
  memberships: Membership[];
  pendingMemberships: PendingMembership[];
  primaryNeighborhoodId: string | null;
}

const BASE_TILES: { href: string; labelKey: TranslationKey; subKey: TranslationKey; icon: LucideIcon }[] = [
  { href: '/community/announcements', labelKey: 'community.hub.tile.announcements.label', subKey: 'community.hub.tile.announcements.sub', icon: Megaphone },
  { href: '/newsletter', labelKey: 'community.hub.tile.newsletter.label', subKey: 'community.hub.tile.newsletter.sub', icon: Mail },
  { href: '/community/events', labelKey: 'community.hub.tile.events.label', subKey: 'community.hub.tile.events.sub', icon: Calendar },
  { href: '/community/directory', labelKey: 'community.hub.tile.directory.label', subKey: 'community.hub.tile.directory.sub', icon: Users },
  { href: '/community/volunteers', labelKey: 'community.hub.tile.volunteers.label', subKey: 'community.hub.tile.volunteers.sub', icon: HeartHandshake },
  { href: '/community/helplines', labelKey: 'community.hub.tile.helplines.label', subKey: 'community.hub.tile.helplines.sub', icon: Phone },
  { href: '/community/vendors', labelKey: 'community.hub.tile.vendors.label', subKey: 'community.hub.tile.vendors.sub', icon: Store },
  { href: '/community/home-services', labelKey: 'community.hub.tile.homeServices.label', subKey: 'community.hub.tile.homeServices.sub', icon: Wrench },
  { href: '/community/auto-booking', labelKey: 'community.hub.tile.autoBooking.label', subKey: 'community.hub.tile.autoBooking.sub', icon: Car },
  { href: '/community/doctors', labelKey: 'community.hub.tile.doctors.label', subKey: 'community.hub.tile.doctors.sub', icon: Stethoscope },
  { href: '/community/queries', labelKey: 'community.hub.tile.queries.label', subKey: 'community.hub.tile.queries.sub', icon: MessageSquareWarning },
  { href: '/community/chat', labelKey: 'community.hub.tile.chat.label', subKey: 'community.hub.tile.chat.sub', icon: MessagesSquare },
  { href: '/community/groups', labelKey: 'community.hub.tile.groups.label', subKey: 'community.hub.tile.groups.sub', icon: LifeBuoy },
  { href: '/community/marketplace', labelKey: 'community.hub.tile.marketplace.label', subKey: 'community.hub.tile.marketplace.sub', icon: Tag },
  { href: '/community/jobs', labelKey: 'community.hub.tile.jobs.label', subKey: 'community.hub.tile.jobs.sub', icon: Briefcase },
  { href: '/community/documents', labelKey: 'community.hub.tile.documents.label', subKey: 'community.hub.tile.documents.sub', icon: FileText },
  { href: '/community/accounts', labelKey: 'community.hub.tile.accounts.label', subKey: 'community.hub.tile.accounts.sub', icon: Wallet },
  { href: '/community/hobbies', labelKey: 'community.hub.tile.hobbies.label', subKey: 'community.hub.tile.hobbies.sub', icon: Palette },
  { href: '/community/settings', labelKey: 'community.hub.tile.settings.label', subKey: 'community.hub.tile.settings.sub', icon: Settings },
];

const MEMBERS_TILE = {
  href: '/community/members',
  labelKey: 'community.hub.tile.members.label' as TranslationKey,
  subKey: 'community.hub.tile.members.sub' as TranslationKey,
  icon: UserCog,
};

const FEES_TILE = {
  href: '/community/fees',
  labelKey: 'community.hub.tile.fees.label' as TranslationKey,
  subKey: 'community.hub.tile.fees.sub' as TranslationKey,
  icon: IndianRupee,
};

export function CommunityHubClient() {
  const router = useRouter();
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data, loading } = useCommunityData<MeResponse>('/community/me');
  const [panicBusy, setPanicBusy] = useState(false);
  const [panicMsg, setPanicMsg] = useState('');
  // Same auto-open-first-then-list-the-rest WhatsApp pattern as the elder's
  // personal SOS (see components/emergency-actions.tsx / lib/emergency-notify.ts).
  const [waRemaining, setWaRemaining] = useState<WhatsAppRecipient[]>([]);
  const [waMessage, setWaMessage] = useState('');
  const [emergencyTemplate, setEmergencyTemplate] = useState('This is an emergency, I need help.{{location}}');
  useEffect(() => {
    fetch('/api/v1/whatsapp-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data.emergency_help) setEmergencyTemplate(j.data.emergency_help); })
      .catch(() => {});
  }, []);

  // Accounts is association bookkeeping — a caregiver-managed concern, not something
  // an elder needs on their own home screen. Fetched separately from community
  // membership since it's the platform role (elder vs caregiver), not a community one.
  const [myRole, setMyRole] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMyRole(j.data.role); })
      .catch(() => {});
  }, []);

  if (loading) {
    return <p className="text-text-secondary">{t('community.hub.loadingYourCommunity')}</p>;
  }

  const membership = data?.memberships?.[0];
  const pending = data?.pendingMemberships?.[0];

  if (!membership && pending) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold text-text">{t('community.hub.pendingApprovalTitle')}</h1>
        <p className="mt-2 text-text-secondary">
          {t('community.hub.pendingApprovalBody').replace('{name}', pending.neighborhood.name)}
        </p>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold text-text">{t('community.hub.joinYourCommunity')}</h1>
        <p className="mt-2 text-text-secondary">
          {t('community.hub.joinIntro')}
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/community/join">{t('community.hub.enterCommunityCode')}</Link>
        </Button>
      </div>
    );
  }

  async function raisePanicAlert() {
    if (!confirm(t('community.hub.confirmPanic'))) return;
    setPanicBusy(true);
    setPanicMsg('');
    setWaRemaining([]);

    const send = async (lat?: number, lng?: number) => {
      try {
        const result = await communityApi.post<{ whatsappRecipients?: WhatsAppRecipient[] }>(
          '/community/panic',
          { lat, lng },
        );
        setPanicMsg(t('community.hub.alertSent'));
        if (result.whatsappRecipients?.length) {
          const message = buildSosMessage(emergencyTemplate, lat, lng);
          setWaMessage(message);
          setWaRemaining(openFirstAndReturnRest(result.whatsappRecipients, message));
        }
      } catch (err) {
        setPanicMsg(err instanceof Error ? err.message : t('community.hub.couldNotSendAlert'));
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
            {membership.role === 'member' ? t('community.hub.resident') : t('community.hub.managementCommittee')}
            {membership.flatNumber ? ` · ${membership.flatNumber}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-900">
            {t('community.hub.codePrefix').replace('{code}', membership.neighborhood.joinCode)}
          </span>
          <Link href="/community/settings" className="text-sm font-semibold text-danger-600 hover:underline">
            {t('community.hub.leaveThisCommunity')}
          </Link>
        </div>
      </div>

      <Card className="mt-6 border-danger-100 bg-danger-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 shrink-0 text-danger-600" />
            <div>
              <p className="text-lg font-bold text-text">{t('community.hub.panicAlertTitle')}</p>
              <p className="text-sm text-text-secondary">
                {t('community.hub.panicAlertSub')}
              </p>
            </div>
          </div>
          <Button variant="danger" size="lg" onClick={raisePanicAlert} disabled={panicBusy}>
            {panicBusy ? t('community.hub.sending') : t('community.hub.getHelpNow')}
          </Button>
        </div>
        {panicMsg && <p className="mt-3 font-semibold text-danger-900">{panicMsg}</p>}
        {waRemaining.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-semibold text-text">Also notify by WhatsApp:</p>
            <div className="flex flex-wrap gap-2">
              {waRemaining.map((r) => (
                <a
                  key={r.phone}
                  href={buildWaLink(r.phone, waMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-sm font-semibold text-success-600"
                >
                  <MessageCircle className="h-4 w-4" />
                  {r.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(membership.role === 'member' ? BASE_TILES : [...BASE_TILES, MEMBERS_TILE, FEES_TILE])
          .filter((tile) => myRole !== 'elder' || tile.href !== '/community/accounts')
          .map(({ href, labelKey, subKey, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <Icon className="h-6 w-6 text-primary-600" />
              </span>
              <span>
                <span className="block font-bold text-text">{t(labelKey)}</span>
                <span className="block text-sm text-text-secondary">{t(subKey)}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
