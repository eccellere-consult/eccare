'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, Plus, Trash2, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { communityApi } from '@/lib/community-client';
import { DAY_NAMES, VEHICLE_TYPES, minuteToTime, timeToMinute } from '@/lib/delivery-pricing';

interface Slot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}
interface Profile {
  vehicleType: string;
  maxWeightKg: number;
  radiusKm: number;
  availableNow: boolean;
  upiId: string | null;
  slots: Slot[];
}
interface Loaded {
  profile: Profile | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  deliveryEnabled: boolean;
}

/** A slot as typed in the form: times stay text until saved, so half-typed times don't jump. */
interface SlotRow {
  key: number;
  dayOfWeek: number;
  start: string;
  end: string;
}

const selectClass =
  'flex h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

let nextKey = 1;
const toRow = (s: Slot): SlotRow => ({ key: nextKey++, dayOfWeek: s.dayOfWeek, start: minuteToTime(s.startMinute), end: minuteToTime(s.endMinute) });

export function DeliveryPartnerSelfService() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');

  const [vehicleType, setVehicleType] = useState('two_wheeler');
  const [maxWeightKg, setMaxWeightKg] = useState('10');
  const [radiusKm, setRadiusKm] = useState('5');
  const [availableNow, setAvailableNow] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [rows, setRows] = useState<SlotRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function fill(p: Profile | null) {
    if (!p) {
      // A sensible first suggestion: weekday evenings.
      setRows([1, 2, 3, 4, 5].map((d) => toRow({ dayOfWeek: d, startMinute: 17 * 60, endMinute: 20 * 60 })));
      return;
    }
    setVehicleType(p.vehicleType);
    setMaxWeightKg(String(p.maxWeightKg));
    setRadiusKm(String(p.radiusKm));
    setAvailableNow(p.availableNow);
    setUpiId(p.upiId ?? '');
    setRows(p.slots.map(toRow));
  }

  useEffect(() => {
    communityApi
      .get<Loaded>('/provider/delivery')
      .then((data) => {
        setLoaded(data);
        fill(data.profile);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load.'));
  }, []);

  function updateRow(key: number, patch: Partial<SlotRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    const slots: Slot[] = [];
    for (const r of rows) {
      const startMinute = timeToMinute(r.start);
      const endMinute = timeToMinute(r.end);
      if (startMinute === null || endMinute === null) {
        setError(`Please enter times like 17:30 for ${DAY_NAMES[r.dayOfWeek]}.`);
        return;
      }
      if (endMinute - startMinute < 30) {
        setError(`On ${DAY_NAMES[r.dayOfWeek]}, the free time must end at least 30 minutes after it starts.`);
        return;
      }
      slots.push({ dayOfWeek: r.dayOfWeek, startMinute, endMinute });
    }

    setBusy(true);
    try {
      const data = await communityApi.put<{ profile: Profile }>('/provider/delivery', {
        vehicleType,
        maxWeightKg: Number(maxWeightKg),
        radiusKm: Number(radiusKm),
        availableNow,
        upiId: upiId.trim() || null,
        slots,
      });
      fill(data.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <Card className="mt-4">
        <CardContent className="py-10 text-center text-text-secondary">{loadError}</CardContent>
      </Card>
    );
  }
  if (!loaded) return <p className="mt-4 text-text-secondary">Loading…</p>;

  return (
    <form onSubmit={save} className="mt-4 flex flex-col gap-6">
      {loaded.verificationStatus !== 'verified' && (
        <Card className="border-accent-100 bg-accent-50">
          <CardContent className="pt-6 text-sm text-text">
            <p className="font-bold">
              {loaded.verificationStatus === 'rejected' ? 'Your account was not approved' : 'Waiting for EC to approve you'}
            </p>
            <p className="mt-1 text-text-secondary">
              You will be offered deliveries only after EC has checked your ID proof. Upload it on your{' '}
              <a href="/provider" className="font-semibold text-primary-600 underline">provider profile</a> if you have not yet.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="flex items-center gap-2 font-bold text-text">
            <Bike className="h-5 w-5 text-primary-600" /> How you deliver
          </h2>

          <label className="flex min-h-tap items-center gap-3 rounded-xl border border-border px-4 py-3">
            <input
              type="checkbox"
              checked={availableNow}
              onChange={(e) => {
                setAvailableNow(e.target.checked);
                setSaved(false);
              }}
              className="h-5 w-5 accent-primary-600"
            />
            <span className="flex-1">
              <span className="block font-semibold text-text">I&apos;m free to deliver right now</span>
              <span className="block text-sm text-text-secondary">Turn this on to get offers outside your weekly free time too.</span>
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${availableNow ? 'bg-success-50 text-success-600' : 'bg-border text-text-secondary'}`}
            >
              {availableNow ? 'Free now' : 'Not now'}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-vehicle">Vehicle</Label>
              <select id="d-vehicle" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={selectClass}>
                {VEHICLE_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-weight">Heaviest order you can carry (kg)</Label>
              <Input id="d-weight" type="number" min={1} max={200} value={maxWeightKg} onChange={(e) => setMaxWeightKg(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-radius">How far you will go (km)</Label>
              <Input id="d-radius" type="number" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:max-w-sm">
            <Label htmlFor="d-upi">UPI ID for your earnings</Label>
            <Input id="d-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" autoCapitalize="none" />
            <p className="text-xs text-text-secondary">EC pays your delivery earnings to this UPI ID.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-text">
              <Clock className="h-5 w-5 text-primary-600" /> Your free time each week
            </h2>
            <p className="mt-1 text-sm text-text-secondary">You will only be offered deliveries during these times (India time).</p>
          </div>

          {rows.length === 0 && <p className="text-sm text-text-secondary">No free time added yet.</p>}

          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.key} className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <Label htmlFor={`d-day-${r.key}`} className="text-xs">Day</Label>
                  <select id={`d-day-${r.key}`} value={r.dayOfWeek} onChange={(e) => updateRow(r.key, { dayOfWeek: Number(e.target.value) })} className={selectClass}>
                    {DAY_NAMES.map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`d-from-${r.key}`} className="text-xs">From</Label>
                    <Input id={`d-from-${r.key}`} type="time" value={r.start} onChange={(e) => updateRow(r.key, { start: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`d-to-${r.key}`} className="text-xs">To</Label>
                    <Input id={`d-to-${r.key}`} type="time" value={r.end} onChange={(e) => updateRow(r.key, { end: e.target.value })} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${DAY_NAMES[r.dayOfWeek]} ${r.start} to ${r.end}`}
                  onClick={() => {
                    setRows((rs) => rs.filter((x) => x.key !== r.key));
                    setSaved(false);
                  }}
                >
                  <Trash2 className="h-5 w-5 text-danger-600" />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setRows((rs) => [...rs, toRow({ dayOfWeek: 6, startMinute: 10 * 60, endMinute: 13 * 60 })])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add free time
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {saved && <p className="text-sm font-semibold text-success-600">Saved.</p>}
      <Button type="submit" disabled={busy} className="self-start">
        <Save className="mr-2 h-4 w-4" />
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
