'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { TourButton } from '@/components/tour/TourButton';
import { communityApi } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

export default function JoinCommunityPage() {
  const router = useRouter();
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const [joinCode, setJoinCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await communityApi.post<{ status: 'pending' | 'approved' | 'rejected' }>('/community/join', {
        joinCode: joinCode.trim(),
        flatNumber: flatNumber.trim() || undefined,
      });
      if (result.status === 'pending') {
        // Stay on this page with a confirmation instead of redirecting into a
        // community the caller can't actually see yet (requireMembership 403s
        // a pending row) — that would just look broken.
        setPending(true);
        return;
      }
      router.push('/community');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('community.join.couldNotJoin'));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <CommunityPageFrame title={t('community.join.title')}>
        <Card className="max-w-lg">
          <CardContent className="py-8 text-center">
            <p className="font-semibold text-text">{t('community.join.requestSent')}</p>
          </CardContent>
        </Card>
      </CommunityPageFrame>
    );
  }

  return (
    <CommunityPageFrame
      title={t('community.join.title')}
      subtitle={t('community.join.subtitle')}
    >
      <div className="max-w-lg">
        <TourButton tourId="joinCommunity" />
      </div>

      <Card className="mt-3 max-w-lg">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="joinCode">{t('community.join.communityCode')}</Label>
              <Input
                id="joinCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                className="text-lg tracking-widest"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="flatNumber">{t('community.join.flatNumber')}</Label>
              <Input
                id="flatNumber"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder={t('community.join.flatNumberPlaceholder')}
              />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" size="lg" disabled={busy || joinCode.trim().length < 4}>
              {busy ? t('community.join.joining') : t('community.join.joinCommunity')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 max-w-lg text-sm text-text-secondary">
        {t('community.join.noCodeYet')}{' '}
        <Link href="/community-registration" className="font-semibold text-primary-600 hover:underline">
          {t('community.join.registerYourCommunity')}
        </Link>
      </p>
    </CommunityPageFrame>
  );
}
