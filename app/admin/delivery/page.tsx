'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, IndianRupee, Power, Calculator, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { PROVIDER_CATEGORIES } from '@/lib/provider-categories';
import { DAY_NAMES, PARCEL_SIZES, VEHICLE_TYPES, minuteToTime, quoteDelivery, type ParcelSize, type RateCard } from '@/lib/delivery-pricing';

interface Partner {
  id: string;
  businessName: string;
  serviceArea: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  certificationFilePath: string | null;
  createdAt: string;
  user: { name: string; phone: string | null };
  deliveryProfile: {
    vehicleType: string;
    maxWeightKg: number;
    radiusKm: number;
    availableNow: boolean;
    upiId: string | null;
    slots: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  } | null;
}
interface DeliveryAdmin {
  enabled: boolean;
  rateCard: RateCard;
  partners: Partner[];
}

const RATE_FIELDS: { key: Exclude<keyof RateCard, 'categorySurcharges'>; label: string; hint: string; step?: string }[] = [
  { key: 'baseCharge', label: 'Base charge (₹)', hint: 'Every delivery starts with this.' },
  { key: 'perKm', label: 'Per km (₹)', hint: 'Times the estimated road distance.' },
  { key: 'perKg', label: 'Per kg (₹)', hint: 'Times the weight of the order.' },
  { key: 'minimumCharge', label: 'Minimum charge (₹)', hint: 'No delivery costs less than this.' },
  { key: 'sizeMediumSurcharge', label: 'Medium parcel extra (₹)', hint: 'A carton.' },
  { key: 'sizeLargeSurcharge', label: 'Large parcel extra (₹)', hint: 'Needs both hands or a vehicle.' },
  { key: 'roadFactor', label: 'Road allowance (×)', hint: 'Straight-line distance × this ≈ road distance. 1.3 suits most towns.', step: '0.05' },
];

const STATUS_BADGE: Record<Partner['verificationStatus'], 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  verified: 'success',
  rejected: 'danger',
};
const vehicleLabel = (v: string) => VEHICLE_TYPES.find((x) => x.value === v)?.label ?? v;

export default function AdminDeliveryPage() {
  const { data, loading, error, setData } = useCommunityData<DeliveryAdmin>('/admin/delivery');

  const [rates, setRates] = useState<Record<string, string>>({});
  const [surcharges, setSurcharges] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Example on the page so the admin sees what a customer would pay.
  const [exKm, setExKm] = useState('3');
  const [exKg, setExKg] = useState('4');
  const [exSize, setExSize] = useState<ParcelSize>('small');
  const [exCategory, setExCategory] = useState('grocery');

  useEffect(() => {
    if (!data) return;
    setRates(Object.fromEntries(RATE_FIELDS.map((f) => [f.key, String(data.rateCard[f.key])])));
    setSurcharges(Object.fromEntries(Object.entries(data.rateCard.categorySurcharges).map(([k, v]) => [k, String(v)])));
  }, [data]);

  const draftCard: RateCard | null = useMemo(() => {
    const nums = Object.fromEntries(RATE_FIELDS.map((f) => [f.key, Number(rates[f.key])]));
    if (RATE_FIELDS.some((f) => !Number.isFinite(nums[f.key]) || nums[f.key] < 0)) return null;
    const cats = Object.fromEntries(
      Object.entries(surcharges)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => Number.isFinite(v) && v > 0),
    );
    return { ...(nums as Omit<RateCard, 'categorySurcharges'>), categorySurcharges: cats };
  }, [rates, surcharges]);

  const example = draftCard
    ? quoteDelivery(draftCard, { straightKm: Number(exKm), weightKg: Number(exKg), size: exSize, category: exCategory })
    : null;

  async function toggle() {
    if (!data) return;
    const next = !data.enabled;
    if (next && !window.confirm('Switch delivery On? Delivery partners can then sign up, and orders will start showing a delivery charge.')) return;
    setSwitching(true);
    try {
      setData(await communityApi.patch<DeliveryAdmin>('/admin/delivery', { enabled: next }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not switch.');
    } finally {
      setSwitching(false);
    }
  }

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaved(false);
    if (!draftCard) {
      setSaveError('Please enter a number of 0 or more in every box.');
      return;
    }
    if (draftCard.roadFactor < 1 || draftCard.roadFactor > 3) {
      setSaveError('Road allowance must be between 1 and 3.');
      return;
    }
    setBusy(true);
    try {
      setData(await communityApi.patch<DeliveryAdmin>('/admin/delivery', { rateCard: draftCard }));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-danger-600">{error ?? 'Could not load.'}</p>;

  const verified = data.partners.filter((p) => p.verificationStatus === 'verified').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Delivery</h1>
      <p className="mt-1 text-text-secondary">Local delivery partners, their free time, and what a delivery costs.</p>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <Power className="h-5 w-5 text-primary-600" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-bold text-text">
              Delivery is {data.enabled ? 'On' : 'Off'}
              <Badge variant={data.enabled ? 'success' : 'muted'}>{data.enabled ? 'On' : 'Off'}</Badge>
            </div>
            <p className="text-sm text-text-secondary">
              {data.enabled
                ? 'People can sign up as delivery partners.'
                : 'Nobody sees anything yet. Set your rates, then switch On on launch day.'}
            </p>
          </div>
          <Button variant={data.enabled ? 'outline' : 'primary'} onClick={toggle} disabled={switching}>
            {switching ? 'Switching…' : data.enabled ? 'Switch Off' : 'Switch On'}
          </Button>
        </CardContent>
      </Card>

      <form onSubmit={saveRates} className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="flex items-center gap-2 font-bold text-text">
              <IndianRupee className="h-5 w-5 text-primary-600" /> Rate card
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {RATE_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`rate-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`rate-${f.key}`}
                    type="number"
                    min={0}
                    step={f.step ?? '0.5'}
                    value={rates[f.key] ?? ''}
                    onChange={(e) => {
                      setRates((r) => ({ ...r, [f.key]: e.target.value }));
                      setSaved(false);
                    }}
                  />
                  <p className="text-xs text-text-secondary">{f.hint}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold text-text">Extra by type of shop (₹)</h3>
              <p className="text-xs text-text-secondary">For example hot food or medicines that need care. Leave 0 for no extra.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {PROVIDER_CATEGORIES.filter((c) => c.value !== 'other').map((c) => (
                  <div key={c.value} className="flex items-center gap-3">
                    <Label htmlFor={`cat-${c.value}`} className="flex-1 text-sm">{c.label}</Label>
                    <Input
                      id={`cat-${c.value}`}
                      type="number"
                      min={0}
                      step="1"
                      className="w-24"
                      value={surcharges[c.value] ?? '0'}
                      onChange={(e) => {
                        setSurcharges((s) => ({ ...s, [c.value]: e.target.value }));
                        setSaved(false);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {saveError && <p className="text-sm text-danger-600">{saveError}</p>}
            {saved && <p className="text-sm font-semibold text-success-600">Saved.</p>}
            <Button type="submit" disabled={busy} className="self-start">
              {busy ? 'Saving…' : 'Save rate card'}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit border-primary-100 bg-primary-50">
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="flex items-center gap-2 font-bold text-text">
              <Calculator className="h-5 w-5 text-primary-600" /> Try it
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ex-km" className="text-xs">Distance, straight line (km)</Label>
                <Input id="ex-km" type="number" min={0} step="0.5" value={exKm} onChange={(e) => setExKm(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ex-kg" className="text-xs">Weight (kg)</Label>
                <Input id="ex-kg" type="number" min={0} step="0.5" value={exKg} onChange={(e) => setExKg(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ex-size" className="text-xs">Parcel size</Label>
                <select id="ex-size" value={exSize} onChange={(e) => setExSize(e.target.value as ParcelSize)} className="h-11 rounded-xl border border-border bg-surface px-3 text-text">
                  {PARCEL_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.value[0].toUpperCase() + s.value.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ex-cat" className="text-xs">Shop type</Label>
                <select id="ex-cat" value={exCategory} onChange={(e) => setExCategory(e.target.value)} className="h-11 rounded-xl border border-border bg-surface px-3 text-text">
                  {PROVIDER_CATEGORIES.filter((c) => c.value !== 'other').map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {example ? (
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
                <dt className="text-text-secondary">Base</dt><dd className="text-right">₹{example.base}</dd>
                <dt className="text-text-secondary">Distance (~{example.roadKm} km by road)</dt><dd className="text-right">₹{example.distance}</dd>
                <dt className="text-text-secondary">Weight</dt><dd className="text-right">₹{example.weight}</dd>
                <dt className="text-text-secondary">Shop type</dt><dd className="text-right">₹{example.category}</dd>
                <dt className="text-text-secondary">Parcel size</dt><dd className="text-right">₹{example.size}</dd>
                <dt className="border-t border-primary-100 pt-1 font-bold text-text">Customer pays</dt>
                <dd className="border-t border-primary-100 pt-1 text-right text-lg font-bold text-text">₹{example.total}</dd>
              </dl>
            ) : (
              <p className="text-sm text-text-secondary">Fill every rate box to see an example.</p>
            )}
            {example?.minimumApplied && <p className="text-xs text-text-secondary">Raised to the minimum charge.</p>}
          </CardContent>
        </Card>
      </form>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-bold text-text">
        <Bike className="h-5 w-5 text-primary-600" /> Delivery partners
        <span className="text-sm font-normal text-text-secondary">· {data.partners.length} signed up, {verified} approved</span>
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Approve or reject them under <a href="/admin/providers" className="font-semibold text-primary-600 underline">Providers</a> after checking their ID proof.
      </p>

      {data.partners.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-10 text-center text-text-secondary">
            No delivery partners yet. Once delivery is On, they sign up on the EC sign-in page as a service provider and pick &ldquo;Delivery partner&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.partners.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-2 pt-6 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-text">{p.user.name}</p>
                    <p className="text-text-secondary">{p.user.phone ?? 'No phone'}{p.serviceArea ? ` · ${p.serviceArea}` : ''}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[p.verificationStatus]}>{p.verificationStatus}</Badge>
                </div>
                {p.deliveryProfile ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-text">
                      {vehicleLabel(p.deliveryProfile.vehicleType)} · up to {p.deliveryProfile.maxWeightKg} kg · {p.deliveryProfile.radiusKm} km
                      {p.deliveryProfile.availableNow && <Badge variant="success">Free now</Badge>}
                    </div>
                    <p className="text-text-secondary">
                      {p.deliveryProfile.slots.length === 0
                        ? 'No weekly free time set'
                        : p.deliveryProfile.slots
                            .map((s) => `${DAY_NAMES[s.dayOfWeek].slice(0, 3)} ${minuteToTime(s.startMinute)}–${minuteToTime(s.endMinute)}`)
                            .join(', ')}
                    </p>
                    <p className="text-text-secondary">UPI: {p.deliveryProfile.upiId ?? 'not added yet'}</p>
                  </>
                ) : (
                  <p className="text-text-secondary">Has not filled in delivery details yet.</p>
                )}
                {p.certificationFilePath ? (
                  <a href={p.certificationFilePath} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1.5 font-semibold text-primary-600 underline">
                    <FileText className="h-4 w-4" /> ID proof
                  </a>
                ) : (
                  <p className="text-danger-600">No ID proof uploaded</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
