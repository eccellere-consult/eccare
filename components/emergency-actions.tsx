'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Ambulance, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

/** Shared between the elder's home hub and the caregiver dashboard's own
 *  "emergency" card — extracted from app/elder/elder-home-client.tsx, which
 *  now renders this instead of its own inline copy. Takes no props: it
 *  always acts as "the caller," never an elder-specific id — POST
 *  /api/v1/emergency/sos already works this way (auth.userId is the target),
 *  so a caregiver using this on their own dashboard needs zero backend
 *  change. Uses the defensive useLanguage() pattern already established in
 *  components/orders-list.tsx/payments-due.tsx: translated on the elder side
 *  (wrapped in LanguageProvider), English fallback on the family side (which
 *  isn't). */
export function EmergencyActions() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');

  const [primaryContact, setPrimaryContact] = useState<EmergencyContactRef | null>(null);
  useEffect(() => {
    fetch('/api/v1/emergency/contacts', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setPrimaryContact(j.data?.find((c: EmergencyContactRef) => c.phone) ?? null); })
      .catch(() => {});
  }, []);

  const [sosSending, setSosSending] = useState(false);
  const [sosMessage, setSosMessage] = useState('');

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
        credentials: 'include',
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
   *  location to that contact — same wa.me share-intent pattern as
   *  app/admin/invite/page.tsx, a one-tap "Send" the caller does themselves.
   *  Skips the WhatsApp step gracefully when no contact has a phone on file. */
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
    <Card className="border-danger-100">
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
  );
}
