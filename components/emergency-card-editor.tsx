'use client';

import { useEffect, useState } from 'react';
import { HeartPulse, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { healthApi, useHealthData } from '@/lib/health-client';
import { BLOOD_GROUPS, hasEmergencyCard, normaliseBloodGroup, type EmergencyCard } from '@/lib/emergency-card';

const FIELDS: { key: Exclude<keyof EmergencyCard, 'bloodGroup'>; label: string; hint: string; max: number }[] = [
  { key: 'allergies', label: 'Allergies', hint: 'Medicines, foods or anything else. e.g. Penicillin, peanuts', max: 1000 },
  { key: 'medicalConditions', label: 'Medical conditions', hint: 'e.g. Diabetes (on insulin), high BP, heart patient', max: 1000 },
  { key: 'implantsDevices', label: 'Implants and devices', hint: 'e.g. Pacemaker, knee replacement, hearing aid, stent', max: 500 },
  { key: 'emergencyNotes', label: 'Anything else a doctor should know', hint: 'e.g. Takes blood thinners. Speaks only Malayalam.', max: 1000 },
];

const EMPTY: EmergencyCard = { bloodGroup: null, allergies: null, medicalConditions: null, implantsDevices: null, emergencyNotes: null };
const fieldClass =
  'flex w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

/**
 * The emergency card on the Health page: blood group, allergies, conditions, implants and a
 * note. Family members see it beside an SOS alert so they can read it to the ambulance crew
 * or the hospital. Kept off notifications and lock screens on purpose.
 */
export function EmergencyCardEditor({ elderUserId }: { elderUserId?: string }) {
  const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
  const card = useHealthData<EmergencyCard>(`/profile${qs}`);
  const [form, setForm] = useState<EmergencyCard>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!card.data) return;
    setForm({
      bloodGroup: normaliseBloodGroup(card.data.bloodGroup) ?? card.data.bloodGroup ?? null,
      allergies: card.data.allergies ?? null,
      medicalConditions: card.data.medicalConditions ?? null,
      implantsDevices: card.data.implantsDevices ?? null,
      emergencyNotes: card.data.emergencyNotes ?? null,
    });
  }, [card.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const bloodGroup = normaliseBloodGroup(form.bloodGroup);
      const saved = await healthApi.patch<EmergencyCard>('/profile', { elderUserId, ...form, bloodGroup });
      card.setData(saved);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const filled = hasEmergencyCard(card.data);

  return (
    <section className="mt-8" aria-labelledby="ecard-h">
      <h2 id="ecard-h" className="flex items-center gap-2 text-lg font-bold text-text">
        <HeartPulse className="h-5 w-5 text-danger-600" />
        Emergency card
      </h2>
      <p className="mt-1 text-sm text-text-secondary">Family members see this with an SOS alert, to tell the ambulance or the hospital.</p>
      <Card className="mt-3">
        <CardContent className="pt-6">
          {card.loading ? (
            <p className="text-text-secondary">Loading…</p>
          ) : !editing && filled ? (
            <div className="flex flex-col gap-3">
              <EmergencyCardView card={card.data!} />
              <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </div>
          ) : !editing ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-text-secondary">Not filled in yet. It takes a minute and can save time in an emergency.</p>
              <Button onClick={() => setEditing(true)}>Fill in the emergency card</Button>
            </div>
          ) : (
            <form onSubmit={save} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ec-blood">Blood group</Label>
                <select
                  id="ec-blood"
                  value={form.bloodGroup ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value || null }))}
                  className={`${fieldClass} h-11`}
                >
                  <option value="">Not known</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-2">
                  <Label htmlFor={`ec-${f.key}`}>{f.label}</Label>
                  <textarea
                    id={`ec-${f.key}`}
                    rows={2}
                    maxLength={f.max}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                    placeholder={f.hint}
                    className={fieldClass}
                  />
                </div>
              ))}
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/** Read-only card, also shown to family under an SOS alert. */
export function EmergencyCardView({ card, compact = false }: { card: Partial<EmergencyCard>; compact?: boolean }) {
  const rows: [string, string | null | undefined][] = [
    ['Allergies', card.allergies],
    ['Conditions', card.medicalConditions],
    ['Implants / devices', card.implantsDevices],
    ['Note', card.emergencyNotes],
  ];
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-4 ${compact ? 'gap-y-1 text-sm' : 'gap-y-2'}`}>
      <dt className="font-semibold text-text-secondary">Blood group</dt>
      <dd className={`font-bold text-text ${compact ? '' : 'text-xl'}`}>{card.bloodGroup || 'Not known'}</dd>
      {rows
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <div key={label} className="contents">
            <dt className="font-semibold text-text-secondary">{label}</dt>
            <dd className="whitespace-pre-line text-text">{v}</dd>
          </div>
        ))}
    </dl>
  );
}
