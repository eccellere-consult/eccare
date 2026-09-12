'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Heart, Users, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface PricingContent {
  isVisible: boolean;
  elderIntro: string;
  elderFeatures: string[];
  familyIntro: string;
  familyFeatures: string[];
  communityIntro: string;
  communityFeatures: string[];
  elderPrice: number;
  familyMonthlyPrice: number;
  familyAnnualPrice: number;
  communityPrice: number;
  trialDays: number;
}

const PLANS: { key: 'elder' | 'family' | 'community'; title: string; icon: typeof Heart }[] = [
  { key: 'elder', title: 'For Elders', icon: Heart },
  { key: 'family', title: 'For Family', icon: Users },
  { key: 'community', title: 'For Your Community', icon: Building2 },
];

export default function AdminPricingPage() {
  const { data, loading, error, reload } = useCommunityData<PricingContent>('/admin/pricing');
  const [visible, setVisible] = useState(true);
  const [intros, setIntros] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [elderPrice, setElderPrice] = useState('0');
  const [familyMonthlyPrice, setFamilyMonthlyPrice] = useState('199');
  const [familyAnnualPrice, setFamilyAnnualPrice] = useState('2000');
  const [communityPrice, setCommunityPrice] = useState('0');
  const [trialDays, setTrialDays] = useState('14');
  const [visBusy, setVisBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setVisible(data.isVisible);
    setIntros({ elder: data.elderIntro, family: data.familyIntro, community: data.communityIntro });
    setFeatures({
      elder: data.elderFeatures.join('\n'),
      family: data.familyFeatures.join('\n'),
      community: data.communityFeatures.join('\n'),
    });
    setElderPrice(String(data.elderPrice));
    setFamilyMonthlyPrice(String(data.familyMonthlyPrice));
    setFamilyAnnualPrice(String(data.familyAnnualPrice));
    setCommunityPrice(String(data.communityPrice));
    setTrialDays(String(data.trialDays));
  }, [data]);

  async function toggleVisible() {
    setVisBusy(true);
    try {
      await communityApi.patch('/admin/pricing', { isVisible: !visible });
      setVisible((v) => !v);
      reload();
    } catch {
      // Reload picks up the real state either way — no separate error UI needed for a toggle.
      reload();
    } finally {
      setVisBusy(false);
    }
  }

  async function savePlan(key: 'elder' | 'family' | 'community') {
    setSaveBusy(key);
    setSaveError((e) => ({ ...e, [key]: '' }));
    setSaved((s) => ({ ...s, [key]: false }));
    const introField = `${key}Intro`;
    const featuresField = `${key}Features`;
    const featureList = (features[key] ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const priceFields: Record<string, number> =
      key === 'elder'
        ? { elderPrice: Number(elderPrice) || 0 }
        : key === 'community'
          ? { communityPrice: Number(communityPrice) || 0 }
          : { familyMonthlyPrice: Number(familyMonthlyPrice) || 0, familyAnnualPrice: Number(familyAnnualPrice) || 0, trialDays: Number(trialDays) || 0 };

    try {
      await communityApi.patch('/admin/pricing', {
        [introField]: intros[key] ?? '',
        [featuresField]: featureList,
        ...priceFields,
      });
      setSaved((s) => ({ ...s, [key]: true }));
      reload();
    } catch (err) {
      setSaveError((e) => ({ ...e, [key]: err instanceof Error ? err.message : 'Could not save.' }));
    } finally {
      setSaveBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Pricing page</h1>
      <p className="mt-1 text-text-secondary">
        Content and prices shown at <code className="text-sm">eccare.in/pricing</code> and at
        registration — only list features that actually work in the app today.
      </p>

      <Card className="mt-6 max-w-2xl">
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-text">
              {visible ? <Eye className="h-5 w-5 text-primary-600" /> : <EyeOff className="h-5 w-5 text-text-secondary" />}
              Show pricing page to visitors
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Turning this off hides the page from everyone — the content underneath is kept, not deleted.
            </p>
          </div>
          <Button type="button" variant={visible ? 'outline' : 'primary'} disabled={visBusy} onClick={toggleVisible}>
            {visBusy ? 'Saving…' : visible ? 'Visible' : 'Hidden'}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="mt-6 text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="mt-6 text-danger-600">{error}</p>
      ) : (
        PLANS.map(({ key, title, icon: Icon }) => (
          <Card key={key} className="mt-6 max-w-2xl">
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="flex items-center gap-2 font-bold text-text">
                <Icon className="h-5 w-5 text-primary-600" />
                {title}
              </h2>

              {key === 'family' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="family-monthly">Monthly price (₹)</Label>
                    <Input id="family-monthly" type="number" min={0} value={familyMonthlyPrice} onChange={(e) => setFamilyMonthlyPrice(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="family-annual">Annual price (₹)</Label>
                    <Input id="family-annual" type="number" min={0} value={familyAnnualPrice} onChange={(e) => setFamilyAnnualPrice(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="trial-days">Free trial (days)</Label>
                    <Input id="trial-days" type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${key}-price`}>Price (₹/month)</Label>
                  <Input
                    id={`${key}-price`}
                    type="number"
                    min={0}
                    value={key === 'elder' ? elderPrice : communityPrice}
                    onChange={(e) => (key === 'elder' ? setElderPrice(e.target.value) : setCommunityPrice(e.target.value))}
                    className="w-32"
                  />
                  <p className="text-xs text-text-secondary">
                    {key === 'elder' ? 'Kept at 0 by design — the elder never pays.' : "Kept at 0 — community pricing isn't live yet."}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${key}-intro`}>Intro line</Label>
                <textarea
                  id={`${key}-intro`}
                  value={intros[key] ?? ''}
                  onChange={(e) => setIntros((v) => ({ ...v, [key]: e.target.value }))}
                  rows={2}
                  className="flex w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${key}-features`}>Features — one per line</Label>
                <textarea
                  id={`${key}-features`}
                  value={features[key] ?? ''}
                  onChange={(e) => setFeatures((v) => ({ ...v, [key]: e.target.value }))}
                  rows={10}
                  className="flex w-full rounded-xl border border-border bg-surface px-4 py-2 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                />
              </div>

              {saveError[key] && <p className="text-sm text-danger-600">{saveError[key]}</p>}
              {saved[key] && <p className="text-sm font-semibold text-success-600">Saved.</p>}
              <Button type="button" disabled={saveBusy === key} onClick={() => savePlan(key)} className="self-start">
                {saveBusy === key ? 'Saving…' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
