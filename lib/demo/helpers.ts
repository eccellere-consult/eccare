import { randomUUID } from 'node:crypto';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';

/** Everything the demo creates is recognisable and removable: supporting people use
 *  this e-mail domain, the community uses this join code, and the three real test
 *  accounts are matched by e-mail. */
export const DEMO_EMAIL_DOMAIN = 'demo.eccare.in';
export const DEMO_COMMUNITY_CODE = 'SUNR26';
/** Bump when the demo content changes; a loaded demo of an older version refreshes itself once. */
export const DEMO_VERSION = 2;
export const DEMO_COMMUNITY_NAME = 'Kowdiar Gardens Residents Association';
export const DEMO_COMMUNITY_SHORT = 'KGRA';
export const DEMO_LOCALITY = 'Kowdiar';
export const DEMO_CITY = 'Thiruvananthapuram';
export const DEMO_STATE = 'Kerala';
export const DEMO_PINCODE = '695003';
/** Centre of the community; houses and local businesses are placed around it. */
export const DEMO_LAT = 8.5196;
export const DEMO_LNG = 76.9591;
/** Sign-in for the supporting demo providers (doctor, auto, legal, …). The three test
 *  accounts keep whatever password they already have. */
export const DEMO_PASSWORD = 'Demo@EC2026';

export const MAIN_ACCOUNTS = {
  elder: { email: 'elder@eccare.in', password: 'Elder@EC2026', name: 'Devaki Nair' },
  family: { email: 'family@eccare.in', password: 'Family@EC2026', name: 'Arun Nair' },
  provider: { email: 'provider@eccare.in', password: 'Provider@EC2026', name: 'Dhanwantari Pharmacy' },
} as const;

/** A house's postal address, e.g. "KGRA-27, Kowdiar Gardens, Kowdiar, Thiruvananthapuram 695003". */
export const addressOf = (house: string) => `${house}, Kowdiar Gardens, ${DEMO_LOCALITY}, ${DEMO_CITY} ${DEMO_PINCODE}`;

export const newId = () => randomUUID();

// ─── Dates ───────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" in IST, `offset` days from today (negative = past). */
export function istDay(offset: number): string {
  const [y, m, d] = todayIST().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split('T')[0];
}

/** An instant: `offset` days from today at `hhmm` IST. */
export function at(offset: number, hhmm = '10:00'): Date {
  return localTimeToUtcDate(istDay(offset), hhmm);
}

export const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

/** The month `monthsBack` months ago as "YYYY-MM", with the 10th of it as the due date. */
export function billingPeriod(monthsBack: number): { period: string; due: Date } {
  const [y, m] = todayIST().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { period, due: localTimeToUtcDate(`${period}-10`, '23:59') };
}

export const dob = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

// ─── Repeatable "randomness" ────────────────────────────────────────────────

/** A small seeded generator, so the demo is the same shape every time it is loaded. */
export function makeRng(seed = 20261010) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p: number) => next() < p,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}
export type Rng = ReturnType<typeof makeRng>;

/** Counts rows created per module so the admin sees exactly what was loaded. */
export class Tally {
  readonly counts: Record<string, number> = {};
  add(module: string, n = 1) {
    this.counts[module] = (this.counts[module] ?? 0) + n;
  }
}
