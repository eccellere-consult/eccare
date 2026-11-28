// Verified home-care staff: nurses and doctors on home visits, full-time home nurses and
// caretakers, security guards, part-time cooks and house help. Pure (no imports) so the
// API, the screens and the tests share the same rules.

/** The provider category for people (or agencies) offering home-care staff. */
export const CARE_STAFF_CATEGORY = {
  value: 'home_care_staff',
  label: 'Home-care staff (nurse, doctor, caretaker, security, cook, house help)',
} as const;

export type Engagement = 'on_visit' | 'full_time' | 'part_time';

export interface StaffRole {
  value: string;
  label: string;
  /** The section the person is listed under in the EC app. */
  engagement: Engagement;
  /** The usual way this work is charged; the provider can add other rates. */
  defaultUnit: RateUnit;
  /** A competency certificate (nursing council, medical registration...) is required. */
  needsCertificate: boolean;
  /** What the certificate should be, in plain words. */
  certificateHint: string;
}

export const STAFF_ROLES: readonly StaffRole[] = [
  { value: 'home_visit_nurse', label: 'Nurse (home visits)', engagement: 'on_visit', defaultUnit: 'visit', needsCertificate: true, certificateHint: 'Nursing degree or diploma, and nursing council registration' },
  { value: 'home_visit_doctor', label: 'Doctor (home visits)', engagement: 'on_visit', defaultUnit: 'visit', needsCertificate: true, certificateHint: 'Medical degree and medical council registration' },
  { value: 'fulltime_home_nurse', label: 'Home nurse (full time)', engagement: 'full_time', defaultUnit: 'month', needsCertificate: true, certificateHint: 'Nursing degree, diploma or GNM/ANM certificate' },
  { value: 'caretaker', label: 'Caretaker / attendant (full time)', engagement: 'full_time', defaultUnit: 'month', needsCertificate: false, certificateHint: 'Any caregiving or first-aid training certificate (optional)' },
  { value: 'security_guard', label: 'Security guard', engagement: 'full_time', defaultUnit: 'month', needsCertificate: false, certificateHint: 'Security agency licence or training certificate (optional)' },
  { value: 'cook', label: 'Cook (part time)', engagement: 'part_time', defaultUnit: 'month', needsCertificate: false, certificateHint: 'Not needed' },
  { value: 'house_help', label: 'House help (part time)', engagement: 'part_time', defaultUnit: 'month', needsCertificate: false, certificateHint: 'Not needed' },
] as const;

export const ENGAGEMENTS: readonly { value: Engagement; label: string; hint: string }[] = [
  { value: 'on_visit', label: 'Home visits', hint: 'A nurse or doctor comes home when you need one' },
  { value: 'full_time', label: 'Full time', hint: 'Home nurse, caretaker or security, every day' },
  { value: 'part_time', label: 'Part time', hint: 'Cook or house help for a few hours a day' },
];

export const RATE_UNITS = ['visit', 'hour', 'day', 'month'] as const;
export type RateUnit = (typeof RATE_UNITS)[number];
export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  visit: 'per visit',
  hour: 'per hour',
  day: 'per day',
  month: 'per month',
};

/** id_proof: a government photo ID (an Aadhaar card only as the masked Aadhaar from UIDAI). */
export const DOC_KINDS = ['id_proof', 'certificate', 'police_verification', 'photo', 'other'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  id_proof: 'Photo ID proof',
  certificate: 'Skill / competency certificate',
  police_verification: 'Police verification',
  photo: 'Photo of the person',
  other: 'Other document',
};

export const LISTING_STATUSES = ['draft', 'submitted', 'changes_needed', 'approved', 'rejected', 'paused'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Not sent yet',
  submitted: 'Waiting for EC to check',
  changes_needed: 'EC asked for changes',
  approved: 'Approved and listed',
  rejected: 'Not approved',
  paused: 'Paused (not listed)',
};

export function staffRole(value: string | null | undefined): StaffRole | undefined {
  return STAFF_ROLES.find((r) => r.value === value);
}

/** Only the last 4 digits of an Aadhaar number are ever kept. Accepts "1234" or a full
 *  number typed by mistake ("1234 5678 9012" keeps "9012"); anything else is null. */
export function aadhaarLast4(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 4 || digits.length === 12) return digits.slice(-4);
  return null;
}

export interface ListingForCheck {
  personName: string | null | undefined;
  role: string | null | undefined;
  aadhaarLast4: string | null | undefined;
  documents: { kind: string }[];
  rates: { proposedAmount: number | null | undefined }[];
}

/** What is still missing before a listing can be sent to EC for checking (empty = ready). */
export function missingForSubmit(l: ListingForCheck): string[] {
  const missing: string[] = [];
  if (!l.personName || l.personName.trim().length < 2) missing.push("The person's name");
  const role = staffRole(l.role);
  if (!role) missing.push('What work they do');
  if (!l.aadhaarLast4 || !/^\d{4}$/.test(l.aadhaarLast4)) missing.push('Last 4 digits of their Aadhaar');
  if (!l.documents.some((d) => d.kind === 'id_proof')) missing.push('A photo ID proof');
  if (role?.needsCertificate && !l.documents.some((d) => d.kind === 'certificate')) {
    missing.push(`A competency certificate (${role.certificateHint})`);
  }
  if (!l.rates.some((r) => typeof r.proposedAmount === 'number' && r.proposedAmount > 0)) missing.push('At least one rate');
  return missing;
}

/** The date EC checks the person again: the approval date plus the chosen months, but never
 *  later than the earliest expiry date of their documents. */
export function recheckDate(approvedAt: Date, months: number, documentExpiries: (Date | null | undefined)[]): Date {
  const byMonths = new Date(approvedAt);
  byMonths.setMonth(byMonths.getMonth() + Math.max(1, Math.min(36, Math.round(months))));
  const expiries = documentExpiries.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  const earliest = expiries.length ? new Date(Math.min(...expiries.map((d) => d.getTime()))) : null;
  return earliest && earliest < byMonths ? earliest : byMonths;
}

/** Listed for families only when approved, still within the re-check date, and with a rate. */
export function isListed(l: { status: string; verifiedUntil: Date | null; approvedRateCount: number }, now: Date): boolean {
  return l.status === 'approved' && l.approvedRateCount > 0 && (!l.verifiedUntil || l.verifiedUntil > now);
}

/** True when two spellings of a name are the same person's name ("ANITHA K. NAIR" and
 *  "Anitha Nair"): every word of the shorter name appears in the longer one, ignoring
 *  single-letter initials. */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const words = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  if (!a || !b) return false;
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w) => long.includes(w));
}

export interface CertificateRead {
  name: string | null;
  qualification: string | null;
  registrationNumber: string | null;
  /** YYYY-MM-DD, or null when the certificate shows no expiry. */
  expiresOn: string | null;
  looksLikeCertificate: boolean;
}

/** Reads the AI's JSON answer about a certificate photo. Never invents: anything unclear is null. */
export function parseCertificateRead(text: string): CertificateRead | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const date = str(raw.expiresOn, 10);
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) ? date : null;
  return {
    name: str(raw.name, 80),
    qualification: str(raw.qualification, 120),
    registrationNumber: str(raw.registrationNumber, 40),
    expiresOn: validDate,
    looksLikeCertificate: raw.looksLikeCertificate === true,
  };
}

/** The one-paragraph note the admin sees under a certificate the AI has read. */
export function certificateNote(read: CertificateRead, personName: string): string {
  const parts: string[] = [];
  if (!read.looksLikeCertificate) parts.push('This does not look like a certificate.');
  if (read.name) {
    parts.push(
      namesMatch(read.name, personName)
        ? `Name on it: ${read.name} (matches).`
        : `Name on it: ${read.name}. This does NOT match "${personName}" - please check.`,
    );
  } else {
    parts.push('No name could be read.');
  }
  if (read.qualification) parts.push(`Qualification: ${read.qualification}.`);
  if (read.registrationNumber) parts.push(`Registration no.: ${read.registrationNumber}.`);
  parts.push(read.expiresOn ? `Valid until ${read.expiresOn}.` : 'No expiry date seen.');
  return `AI read (please confirm by looking): ${parts.join(' ')}`;
}

/** "₹18,000 per month" */
export function formatRate(amount: number, unit: string): string {
  const label = RATE_UNIT_LABEL[unit as RateUnit] ?? unit;
  return `₹${Math.round(amount).toLocaleString('en-IN')} ${label}`;
}
