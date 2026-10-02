'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// India first and the default; then the places family members most often live
// (the Gulf, Singapore/Malaysia, Europe, North America, Australia/NZ). "Other"
// leaves the number box free-form so any country still works by typing "+" and
// the code. Dial codes only — country names are kept in English.
const COUNTRIES: { dial: string; label: string }[] = [
  { dial: '+91', label: 'India (+91)' },
  { dial: '+971', label: 'United Arab Emirates (+971)' },
  { dial: '+966', label: 'Saudi Arabia (+966)' },
  { dial: '+974', label: 'Qatar (+974)' },
  { dial: '+965', label: 'Kuwait (+965)' },
  { dial: '+968', label: 'Oman (+968)' },
  { dial: '+973', label: 'Bahrain (+973)' },
  { dial: '+65', label: 'Singapore (+65)' },
  { dial: '+60', label: 'Malaysia (+60)' },
  { dial: '+44', label: 'United Kingdom (+44)' },
  { dial: '+353', label: 'Ireland (+353)' },
  { dial: '+49', label: 'Germany (+49)' },
  { dial: '+33', label: 'France (+33)' },
  { dial: '+31', label: 'Netherlands (+31)' },
  { dial: '+41', label: 'Switzerland (+41)' },
  { dial: '+39', label: 'Italy (+39)' },
  { dial: '+34', label: 'Spain (+34)' },
  { dial: '+1', label: 'United States / Canada (+1)' },
  { dial: '+61', label: 'Australia (+61)' },
  { dial: '+64', label: 'New Zealand (+64)' },
  { dial: '+81', label: 'Japan (+81)' },
];
const OTHER = 'other';

function compose(dial: string, local: string): string {
  if (dial === '+91' || dial === OTHER) return local; // India: as typed; Other: caller types the full "+…"
  const digits = local.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${dial}${digits}` : '';
}

/** A mobile-number input that defaults to India. With `allowInternational`
 *  (family accounts, and sign-in) it adds a country picker; the parent just
 *  receives one string — the bare number for India, or "+<code><number>" for
 *  anywhere else, which is exactly what the server's validation expects. */
export function PhoneField({
  id,
  value,
  onChange,
  allowInternational,
  placeholder,
  countryLabel,
  otherLabel,
  helper,
  autoComplete = 'tel',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  allowInternational: boolean;
  placeholder?: string;
  countryLabel: string;
  otherLabel: string;
  helper?: string;
  autoComplete?: string;
}) {
  const [dial, setDial] = useState<string>('+91');
  const [local, setLocal] = useState(value);

  // If international stops being allowed (e.g. the role switched away from
  // family), fall back to India so a stale "+65" can't be submitted.
  useEffect(() => {
    if (!allowInternational && dial !== '+91') {
      setDial('+91');
      setLocal('');
      onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowInternational]);

  return (
    <div className="flex flex-col gap-2">
      {allowInternational && (
        <>
          <Label htmlFor={`${id}-country`}>{countryLabel}</Label>
          <select
            id={`${id}-country`}
            value={dial}
            onChange={(e) => {
              setDial(e.target.value);
              onChange(compose(e.target.value, local));
            }}
            className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {COUNTRIES.map((c) => (
              <option key={c.dial} value={c.dial}>{c.label}</option>
            ))}
            <option value={OTHER}>{otherLabel}</option>
          </select>
        </>
      )}
      <Input
        id={id}
        type="tel"
        autoComplete={autoComplete}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(compose(dial, e.target.value));
        }}
        placeholder={dial === '+91' || dial === OTHER ? placeholder : 'Mobile number'}
      />
      {helper && <p className="text-xs text-text-secondary">{helper}</p>}
    </div>
  );
}
