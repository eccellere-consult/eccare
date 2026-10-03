'use client';

import { useState } from 'react';

const selectClass =
  'flex h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600';

/** Date of birth as three dropdowns (day / month / year) rather than a native
 *  date picker: on a phone a native picker makes someone born in 1948 scroll
 *  back through decades one month at a time. Reports "YYYY-MM-DD" once all three
 *  are chosen, "" otherwise; impossible dates (31 Feb) are left for the server's
 *  check to reject. Year list starts at `maxYear` (youngest allowed) going back. */
export function DateOfBirthField({
  id,
  value,
  onChange,
  labels,
  locale = 'en-IN',
  maxYear = new Date().getFullYear() - 18,
  minYear = new Date().getFullYear() - 110,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  labels: { day: string; month: string; year: string };
  locale?: string;
  maxYear?: number;
  minYear?: number;
}) {
  const [y0, m0, d0] = value ? value.split('-') : ['', '', ''];
  const [year, setYear] = useState(y0 ?? '');
  const [month, setMonth] = useState(m0 ?? '');
  const [day, setDay] = useState(d0 ?? '');

  function update(next: { year?: string; month?: string; day?: string }) {
    const y = next.year ?? year;
    const m = next.month ?? month;
    const d = next.day ?? day;
    if (next.year !== undefined) setYear(y);
    if (next.month !== undefined) setMonth(m);
    if (next.day !== undefined) setDay(d);
    onChange(y && m && d ? `${y}-${m}-${d}` : '');
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const monthName = (m: number) => new Date(2000, m, 1).toLocaleString(locale, { month: 'long' });
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  return (
    <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2" role="group" aria-label={labels.year}>
      <select id={`${id}-day`} aria-label={labels.day} value={day} onChange={(e) => update({ day: e.target.value })} className={selectClass}>
        <option value="">{labels.day}</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={pad(d)}>{d}</option>
        ))}
      </select>
      <select id={`${id}-month`} aria-label={labels.month} value={month} onChange={(e) => update({ month: e.target.value })} className={selectClass}>
        <option value="">{labels.month}</option>
        {Array.from({ length: 12 }, (_, i) => i).map((m) => (
          <option key={m} value={pad(m + 1)}>{monthName(m)}</option>
        ))}
      </select>
      <select id={`${id}-year`} aria-label={labels.year} value={year} onChange={(e) => update({ year: e.target.value })} className={selectClass}>
        <option value="">{labels.year}</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}
