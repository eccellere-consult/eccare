'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Phone, Users, Ambulance, Shield, FileImage } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanionCard } from '@/components/companion-card';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';
import { buildWaLink } from '@/lib/whatsapp';

const AMBULANCE_NUMBER = '108';
const POLICE_NUMBER = '100';

interface EmergencyContactRef {
  id: string;
  name: string;
  phone: string;
  callOrder: number;
}

interface Invite {
  id: string;
  relationship: string;
  caregiverUser: { name: string; phone: string | null };
}

interface PrescriptionRef {
  id: string;
  filePath: string;
  doctorName: string | null;
  fileName: string;
  prescriptionDate: string | null;
  createdAt: string;
}

interface DailyQuote {
  text: string;
  author: string | null;
}

export function ElderHomeClient({
  userName,
  invites,
  quote,
}: {
  userName: string;
  invites: Invite[];
  quote: DailyQuote | null;
}) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRef[]>([]);
  useEffect(() => {
    fetch('/api/v1/health/prescriptions', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data?.length) setPrescriptions(j.data.slice(0, 3)); })
      .catch(() => {});
  }, []);
  // Fetched on mount, not on-demand when Police is pressed, so there's no extra
  // network round trip in the moment someone actually needs it.
  const [primaryContact, setPrimaryContact] = useState<EmergencyContactRef | null>(null);
  useEffect(() => {
    fetch('/api/v1/emergency/contacts', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setPrimaryContact(j.data?.find((c: EmergencyContactRef) => c.phone) ?? null); })
      .catch(() => {});
  }, []);
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [sosSending, setSosSending] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');

  async function respondToInvite(id: string, action: 'accept' | 'decline') {
    await fetch(`/api/v1/family/invites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function getLocation(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 },
      );
    });
  }

  async function handleSOS() {
    if (!confirm(t('elder.home.confirmSOS'))) return;
    setSosSending(true);
    setSosMessage('');
    try {
      const { lat, lng } = await getLocation();
      const res = await fetch('/api/v1/emergency/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'manual', lat, lng }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || t('elder.home.sosErrorGeneric'));
      setSosMessage(t('elder.home.sosSuccess'));
    } catch (err) {
      setSosMessage(err instanceof Error ? err.message : t('elder.home.sosErrorGeneric'));
    } finally {
      setSosSending(false);
    }
  }

  function handleAmbulance() {
    if (confirm(t('elder.home.confirmAmbulance').replace('{number}', AMBULANCE_NUMBER))) {
      window.location.href = `tel:${AMBULANCE_NUMBER}`;
    }
  }

  /** Dials the police helpline and, when a primary emergency contact with a phone
   *  number is on file, also opens a pre-filled WhatsApp message with the current
   *  location to that contact — no paid WhatsApp Business API here, same wa.me
   *  share-intent pattern as app/admin/invite/page.tsx, so it's a one-tap "Send"
   *  the elder does themselves, not a fully automatic send. Skips the WhatsApp
   *  step gracefully (dials police alone) when no contact has a phone on file. */
  async function handlePolice() {
    if (!confirm(t('elder.home.confirmPolice').replace('{number}', POLICE_NUMBER))) return;
    if (primaryContact?.phone) {
      const { lat, lng } = await getLocation();
      const locationLine = lat != null && lng != null ? ` My location: https://www.google.com/maps?q=${lat},${lng}` : '';
      const message = `This is an emergency, I need help.${locationLine}`;
      window.open(buildWaLink(primaryContact.phone, message), '_blank');
    }
    window.location.href = `tel:${POLICE_NUMBER}`;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-text">{t('elder.home.hello')} {userName}</h1>
      <p className="mt-1 text-lg text-text-secondary">{t('elder.home.subtitle')}</p>

      <div className="mt-6">
        <CompanionCard />
      </div>

      {quote?.text && (
        <Card className="mt-6 border-accent-100 bg-accent-50">
          <CardContent className="py-5">
            <p className="text-lg font-semibold italic text-accent-900">&ldquo;{quote.text}&rdquo;</p>
            {quote.author && <p className="mt-2 text-sm text-accent-900/80">— {quote.author}</p>}
          </CardContent>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {pendingInvites.map((invite) => (
            <Card key={invite.id} className="border-accent-100 bg-accent-50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="font-semibold text-accent-900">
                  {invite.caregiverUser.name} {t('elder.home.inviteConnectAs')} {invite.relationship.toLowerCase()}.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondToInvite(invite.id, 'accept')}>
                    {t('common.accept')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondToInvite(invite.id, 'decline')}>
                    {t('common.decline')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/elder/contacts">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
                <Users className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-text">{t('elder.home.callFamily')}</p>
                <p className="text-sm text-text-secondary">{t('elder.home.callFamilySub')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mt-6 border-danger-100">
        <CardHeader>
          <CardTitle className="text-danger-900">{t('elder.home.emergencyTitle')}</CardTitle>
          <CardDescription>{t('elder.home.emergencySub')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="danger" size="lg" className="flex-1" onClick={handleSOS} disabled={sosSending}>
            <AlertTriangle className="h-6 w-6" />
            {sosSending ? t('elder.home.sosSending') : t('elder.home.needHelpNow')}
          </Button>
          <Button variant="outline" size="lg" className="flex-1 border-danger-600 text-danger-600" onClick={handleAmbulance}>
            <Ambulance className="h-6 w-6" />
            {t('elder.home.callAmbulance')}
          </Button>
          <Button variant="outline" size="lg" className="flex-1 border-danger-600 text-danger-600" onClick={handlePolice}>
            <Shield className="h-6 w-6" />
            {t('elder.home.callPolice')}
          </Button>
        </CardContent>
        {sosMessage && <CardContent className="pt-0 text-sm font-semibold text-text">{sosMessage}</CardContent>}
      </Card>

      {prescriptions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary-600" />
              {t('common.myPrescriptions')}
            </CardTitle>
            <CardDescription>{t('elder.home.prescriptionsSub')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {prescriptions.map((p) => (
              <a
                key={p.id}
                href={p.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-primary-50"
              >
                <span className="font-semibold text-text">{p.doctorName ?? p.fileName}</span>
                <span className="text-xs text-text-secondary">
                  {p.prescriptionDate
                    ? new Date(p.prescriptionDate).toLocaleDateString()
                    : new Date(p.createdAt).toLocaleDateString()}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-center">
        <Link href="/elder/profile" className="text-sm font-semibold text-text-secondary underline">
          {t('elder.home.yourProfile')}
        </Link>
      </div>
    </div>
  );
}
