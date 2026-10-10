import { randomUUID } from 'node:crypto';
import { localTimeToUtcDate, todayIST } from '@/lib/medicine-slots';

/** Everything the demo creates is recognisable and removable: supporting people use
 *  this e-mail domain, the community uses this join code, and the three real test
 *  accounts are matched by e-mail. */
export const DEMO_EMAIL_DOMAIN = 'demo.eccare.in';
export const DEMO_COMMUNITY_CODE = 'SUNR26';
export const DEMO_COMMUNITY_NAME = 'Sunrise Residency';
/** Sign-in for the supporting demo providers (doctor, auto, legal, …). The three test
 *  accounts keep whatever password they already have. */
export const DEMO_PASSWORD = 'Demo@EC2026';

export const MAIN_ACCOUNTS = {
  elder: { email: 'elder@eccare.in', password: 'Elder@EC2026', name: 'Lakshmi Narayanan' },
  family: { email: 'family@eccare.in', password: 'Family@EC2026', name: 'Arjun Narayanan' },
  provider: { email: 'provider@eccare.in', password: 'Provider@EC2026', name: 'City Care Pharmacy' },
} as const;

export const newId = () => randomUUID();

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

/** First day of the month `monthsBack` months ago, as "YYYY-MM" and the 10th as due date. */
export function billingPeriod(monthsBack: number): { period: string; due: Date } {
  const [y, m] = todayIST().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { period, due: localTimeToUtcDate(`${period}-10`, '23:59') };
}

export const dob = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

export function money(n: number): string {
  return n.toFixed(2);
}

/** Counts rows created per module so the admin sees exactly what was loaded. */
export class Tally {
  readonly counts: Record<string, number> = {};
  add(module: string, n = 1) {
    this.counts[module] = (this.counts[module] ?? 0) + n;
  }
}

export interface PersonSpec {
  key: string;
  name: string;
  phone: string;
  flat: string;
  born: Date;
  /** Role inside the community. */
  communityRole?: 'member' | 'committee' | 'admin';
  /** Verified volunteer profile, if any. */
  volunteer?: { availability: 'weekdays' | 'weekends' | 'always'; types: string[]; status?: 'verified' | 'pending' };
  hobbies?: string[];
}

/** The neighbours in the demo community (besides the elder and the family member). */
export const NEIGHBOURS: PersonSpec[] = [
  { key: 'meera', name: 'Meera Nair', phone: '9000000101', flat: 'C-301', born: dob(1974, 5, 21), communityRole: 'committee' },
  { key: 'ramesh', name: 'Ramesh Kulkarni', phone: '9000000102', flat: 'A-101', born: dob(1964, 11, 3), communityRole: 'committee' },
  { key: 'rekha', name: 'Rekha Iyer', phone: '9000000103', flat: 'A-404', born: dob(1971, 2, 14), communityRole: 'committee', hobbies: ['rangoli'] },
  { key: 'sunita', name: 'Sunita Deshmukh', phone: '9000000104', flat: 'A-102', born: dob(1957, 8, 30), hobbies: ['bhajan', 'books'] },
  { key: 'kiran', name: 'Kiran Rao', phone: '9000000105', flat: 'B-203', born: dob(1991, 6, 9), volunteer: { availability: 'always', types: ['medical_runs', 'errands'] } },
  { key: 'farida', name: 'Farida Khan', phone: '9000000106', flat: 'A-305', born: dob(1959, 1, 17), hobbies: ['books', 'bhajan'] },
  { key: 'george', name: 'George Mathew', phone: '9000000107', flat: 'B-101', born: dob(1951, 9, 25), hobbies: ['chess'] },
  { key: 'anand', name: 'Anand Subramanian', phone: '9000000108', flat: 'C-102', born: dob(1967, 12, 2), hobbies: ['chess'] },
  { key: 'lata', name: 'Lata Shetty', phone: '9000000109', flat: 'C-205', born: dob(1954, 4, 11), hobbies: ['bhajan'] },
  { key: 'vikram', name: 'Vikram Singh', phone: '9000000110', flat: 'B-304', born: dob(1987, 3, 28), volunteer: { availability: 'weekends', types: ['tech_support', 'errands'] } },
  { key: 'suresh', name: 'Suresh Pillai', phone: '9000000111', flat: 'D-110', born: dob(1962, 7, 19), hobbies: ['walkers'] },
  { key: 'nandini', name: 'Nandini Hegde', phone: '9000000112', flat: 'D-204', born: dob(1978, 10, 5), volunteer: { availability: 'weekdays', types: ['companionship', 'medical_runs'] }, hobbies: ['rangoli'] },
  { key: 'joseph', name: "Joseph D'Souza", phone: '9000000113', flat: 'D-301', born: dob(1947, 1, 8), hobbies: ['walkers'] },
];

export interface ProviderSpec {
  key: string;
  email: string;
  name: string;
  businessName: string;
  category: string;
  phone: string;
  description: string;
  serviceArea: string;
  address: string;
  lat: number;
  lng: number;
  elderCareCategory?: 'home_treatment' | 'home_nursing' | 'companion_service' | 'local_errands';
  born: Date;
}

/** Supporting providers: each one stands for a different provider portal, so the
 *  elder's and family's side of every service has someone real-looking on the other end. */
export const SUPPORT_PROVIDERS: ProviderSpec[] = [
  { key: 'doctor', email: `dr.anita@${DEMO_EMAIL_DOMAIN}`, name: 'Dr. Anita Rao', businessName: 'Rao Family Clinic', category: 'doctor', phone: '9000000201', description: 'General medicine and geriatric care. Home visits for seniors by appointment.', serviceArea: 'Indiranagar, Domlur, HAL', address: '14, 12th Main, Indiranagar, Bengaluru 560038', lat: 12.9784, lng: 77.6408, born: dob(1979, 3, 12) },
  { key: 'auto', email: `ravi.auto@${DEMO_EMAIL_DOMAIN}`, name: 'Ravi Kumar', businessName: 'Ravi Kumar Auto & Taxi', category: 'auto_transport', phone: '9000000202', description: 'Reliable auto and cab rides, hospital drop-offs and airport runs. Patient with elders.', serviceArea: 'Indiranagar, Ulsoor, Koramangala', address: 'Auto stand, 100 Feet Road, Indiranagar', lat: 12.9719, lng: 77.6412, born: dob(1984, 8, 4) },
  { key: 'legal', email: `adv.menon@${DEMO_EMAIL_DOMAIN}`, name: 'Adv. Suresh Menon', businessName: 'Menon & Associates', category: 'legal_help', phone: '9000000203', description: 'Wills, powers of attorney and property transfers. Home registration for senior citizens.', serviceArea: 'Bengaluru', address: '3rd Floor, Commercial Street, Bengaluru 560001', lat: 12.9822, lng: 77.6083, born: dob(1972, 2, 2) },
  { key: 'insurance', email: `securelife@${DEMO_EMAIL_DOMAIN}`, name: 'Pooja Bhandari', businessName: 'SecureLife Insurance Advisors', category: 'insurance', phone: '9000000204', description: 'Independent advisors for senior health and critical-illness cover.', serviceArea: 'Bengaluru', address: '22, Brigade Road, Bengaluru 560025', lat: 12.9716, lng: 77.6063, born: dob(1985, 5, 16) },
  { key: 'property', email: `homecare@${DEMO_EMAIL_DOMAIN}`, name: 'Girish Naik', businessName: 'HomeCare Property Services', category: 'property_management', phone: '9000000205', description: 'Periodic inspection of homes of NRI and senior owners, with repair coordination.', serviceArea: 'Bengaluru', address: '7, 5th Block, Koramangala, Bengaluru 560095', lat: 12.9352, lng: 77.6245, born: dob(1981, 9, 23) },
  { key: 'nursing', email: `sevana@${DEMO_EMAIL_DOMAIN}`, name: 'Sister Mercy Joseph', businessName: 'Sevana Home Nursing', category: 'nursing', phone: '9000000206', description: 'Trained nurses and attendants for home care, post-surgery support and night stays.', serviceArea: 'Indiranagar, Domlur, CV Raman Nagar', address: '45, Defence Colony, Indiranagar, Bengaluru', lat: 12.9758, lng: 77.6385, elderCareCategory: 'home_nursing', born: dob(1976, 12, 1) },
  { key: 'grocery', email: `freshbasket@${DEMO_EMAIL_DOMAIN}`, name: 'Mahesh Gowda', businessName: 'Fresh Basket Grocers', category: 'grocery', phone: '9000000207', description: 'Daily groceries, fruit and vegetables delivered to your door, with senior-friendly packing.', serviceArea: 'Indiranagar, Domlur', address: '9, 80 Feet Road, Indiranagar, Bengaluru', lat: 12.9741, lng: 77.6396, born: dob(1983, 4, 7) },
];
