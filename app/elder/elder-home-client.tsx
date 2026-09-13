'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Users, FileImage } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanionCard } from '@/components/companion-card';
import { EmergencyActions } from '@/components/emergency-actions';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

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
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState(invites);
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

      <div className="mt-6">
        <EmergencyActions />
      </div>

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
