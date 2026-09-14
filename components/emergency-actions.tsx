'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Ambulance, Shield, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';
import { buildWaLink } from '@/lib/whatsapp';
import { buildSosMessage, openFirstAndReturnRest, type WhatsAppRecipient } from '@/lib/emergency-notify';

const AMBULANCE_NUMBER = '108';
const POLICE_NUMBER = '100';

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

  // Fetched once up front (not at send time) so a slow network never delays
  // the actual WhatsApp send — falls back to the hardcoded default if the
  // fetch hasn't resolved yet or failed.
  const [emergencyTemplate, setEmergencyTemplate] = useState('This is an emergency, I need help.{{location}}');
  useEffect(() => {
    fetch('/api/v1/whatsapp-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data.emergency_help) setEmergencyTemplate(j.data.emergency_help); })
      .catch(() => {});
  }, []);

  const [sosSending, setSosSending] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  // Everyone the SOS/dial route notified who has a phone on file, minus
  // whoever's WhatsApp chat just auto-opened — rendered as one-tap "Send"
  // buttons, since only the first chat can open without a further tap (see
  // lib/emergency-notify.ts). waMessage is the exact text sent to the first
  // recipient (location included when available) — kept alongside so the
  // remaining buttons send the same wording instead of rebuilding it
  // without the location captured at trigger time.
  const [waRemaining, setWaRemaining] = useState<WhatsAppRecipient[]>([]);
  const [waMessage, setWaMessage] = useState('');

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

  /** Fires the SOS/dial route and, on success, auto-opens the first
   *  WhatsApp recipient's chat and queues the rest as one-tap buttons — see
   *  lib/emergency-notify.ts. Shared by handleSOS and logEmergencyDial so
   *  every trigger (the SOS button, ambulance, police) notifies the same
   *  way, not just the SOS button. */
  async function triggerAndQueueWhatsApp(triggerType: string, lat?: number, lng?: number) {
    const res = await fetch('/api/v1/emergency/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ triggerType, lat, lng }),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data?.whatsappRecipients)) {
      const message = buildSosMessage(emergencyTemplate, lat, lng);
      setWaMessage(message);
      setWaRemaining(openFirstAndReturnRest(json.data.whatsappRecipients, message));
    }
    return json;
  }

  async function handleSOS() {
    if (!confirm(t('elder.home.confirmSOS'))) return;
    setSosSending(true);
    setSosMessage('');
    setWaRemaining([]);
    try {
      const { lat, lng } = await getLocation();
      const json = await triggerAndQueueWhatsApp('manual', lat, lng);
      if (!json.success) throw new Error(json?.error?.message || t('elder.home.sosErrorGeneric'));
      setSosMessage(t('elder.home.sosSuccess'));
    } catch (err) {
      setSosMessage(err instanceof Error ? err.message : t('elder.home.sosErrorGeneric'));
    } finally {
      setSosSending(false);
    }
  }

  /** Logs an SOSEvent (same route the "I need help" button uses, just a
   *  different triggerType) so an ambulance/police dial shows up in the
   *  elder's and family's SOS history with a map link, pushes a
   *  notification to caregivers/contacts/committee, and queues the same
   *  WhatsApp send as the SOS button — previously only the manual SOS
   *  button did any of this, so calling 108/100 directly left family with
   *  no idea it happened. Deliberately fire-and-forget, never awaited
   *  before dialing: the phone call itself is the priority action and must
   *  not wait on a network request or a slow GPS fix. */
  function logEmergencyDial(triggerType: 'ambulance' | 'police', lat?: number, lng?: number) {
    triggerAndQueueWhatsApp(triggerType, lat, lng).catch(() => {});
  }

  function handleAmbulance() {
    if (!confirm(t('elder.home.confirmAmbulance').replace('{number}', AMBULANCE_NUMBER))) return;
    window.location.href = `tel:${AMBULANCE_NUMBER}`;
    getLocation().then(({ lat, lng }) => logEmergencyDial('ambulance', lat, lng));
  }

  function handlePolice() {
    if (!confirm(t('elder.home.confirmPolice').replace('{number}', POLICE_NUMBER))) return;
    window.location.href = `tel:${POLICE_NUMBER}`;
    getLocation().then(({ lat, lng }) => logEmergencyDial('police', lat, lng));
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
      {waRemaining.length > 0 && (
        <CardContent className="flex flex-col gap-2 pt-0">
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
        </CardContent>
      )}
    </Card>
  );
}
