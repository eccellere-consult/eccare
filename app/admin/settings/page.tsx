'use client';

import { useEffect, useState } from 'react';
import { Percent, Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface Settings {
  platformFeePercent: number;
  elderCareAdPricePerMonth: number;
}

export default function AdminSettingsPage() {
  const { data, loading, error, reload } = useCommunityData<Settings>('/admin/settings');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [adPrice, setAdPrice] = useState('');
  const [adBusy, setAdBusy] = useState(false);
  const [adError, setAdError] = useState('');
  const [adSaved, setAdSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setValue(String(data.platformFeePercent));
      setAdPrice(String(data.elderCareAdPricePerMonth));
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaveError('');
    setSaved(false);
    const percent = Number(value);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setSaveError('Please enter a number between 0 and 100.');
      setBusy(false);
      return;
    }
    try {
      await communityApi.patch('/admin/settings', { platformFeePercent: percent });
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAdPrice(e: React.FormEvent) {
    e.preventDefault();
    setAdBusy(true);
    setAdError('');
    setAdSaved(false);
    const amount = Number(adPrice);
    if (Number.isNaN(amount) || amount < 0) {
      setAdError('Please enter a valid amount.');
      setAdBusy(false);
      return;
    }
    try {
      await communityApi.patch('/admin/settings', { elderCareAdPricePerMonth: amount });
      setAdSaved(true);
      reload();
    } catch (err) {
      setAdError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setAdBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Platform settings</h1>
      <p className="mt-1 text-text-secondary">Configuration that applies across every community and provider.</p>

      <Card className="mt-6 max-w-md">
        <CardContent className="pt-6">
          <h2 className="flex items-center gap-2 font-bold text-text">
            <Percent className="h-5 w-5 text-primary-600" />
            Platform fee
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            EC&apos;s commission on provider-service orders and community fee payments. Every payment still lands
            fully in EC&apos;s own Razorpay account — there&apos;s no automatic split payout yet — so this rate is
            recorded on each paid order/fee for your own accounting, not deducted automatically. Vendors and
            associations are settled outside the app based on that record.
          </p>

          {loading ? (
            <p className="mt-4 text-text-secondary">Loading…</p>
          ) : error ? (
            <p className="mt-4 text-danger-600">{error}</p>
          ) : (
            <form onSubmit={save} className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform-fee">Commission rate (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="platform-fee"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-text-secondary">%</span>
                </div>
              </div>
              {saveError && <p className="text-sm text-danger-600">{saveError}</p>}
              {saved && <p className="text-sm font-semibold text-success-600">Saved.</p>}
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-md">
        <CardContent className="pt-6">
          <h2 className="flex items-center gap-2 font-bold text-text">
            <Megaphone className="h-5 w-5 text-primary-600" />
            Elder Care Services — featured ad price
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            What a verified provider pays (via Razorpay) to be featured at the top of the Elder Care
            Services directory for 30 days. This is EC&apos;s own ad revenue, not a fee on a vendor payment.
          </p>

          {loading ? (
            <p className="mt-4 text-text-secondary">Loading…</p>
          ) : error ? (
            <p className="mt-4 text-danger-600">{error}</p>
          ) : (
            <form onSubmit={saveAdPrice} className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ad-price">Price per 30 days (₹)</Label>
                <Input
                  id="ad-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={adPrice}
                  onChange={(e) => setAdPrice(e.target.value)}
                  className="w-32"
                />
              </div>
              {adError && <p className="text-sm text-danger-600">{adError}</p>}
              {adSaved && <p className="text-sm font-semibold text-success-600">Saved.</p>}
              <Button type="submit" disabled={adBusy} className="self-start">
                {adBusy ? 'Saving…' : 'Save'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
