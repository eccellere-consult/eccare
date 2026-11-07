import { sendGenericEmail } from '@/lib/email';

export const PARTNER_INTERESTS = [
  { value: 'csr', label: 'CSR funding' },
  { value: 'sponsor_elders', label: 'Sponsor free EC access for elders' },
  { value: 'community', label: 'Support a community or neighbourhood programme' },
  { value: 'offline_services', label: 'Support offline care services (future)' },
  { value: 'other', label: 'Something else' },
] as const;

export type PartnerInterest = (typeof PARTNER_INTERESTS)[number]['value'];

export const PARTNER_INTEREST_VALUES = PARTNER_INTERESTS.map((i) => i.value) as [PartnerInterest, ...PartnerInterest[]];

export const PARTNER_STATUSES = ['new', 'contacted', 'closed'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export function interestLabel(value: string): string {
  return PARTNER_INTERESTS.find((i) => i.value === value)?.label ?? value;
}

/** Who gets the "new enquiry" email. Set PARTNER_ENQUIRY_EMAIL to change it. */
export function partnerEnquiryRecipient(): string {
  return process.env.PARTNER_ENQUIRY_EMAIL || 'contact@eccare.in';
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Emails the team about a new enquiry. Does nothing (returns false) until the email service is set
 *  up (RESEND_API_KEY); the enquiry is already saved and shows in Admin > Partner enquiries. */
export async function notifyTeamOfEnquiry(e: {
  interest: string;
  name: string;
  organisation: string | null;
  phone: string;
  email: string | null;
  message: string;
}): Promise<boolean> {
  const html = `
    <div style="font-family: sans-serif; max-width: 520px;">
      <h2 style="color: #0B5563;">New partner enquiry</h2>
      <p><strong>Interest:</strong> ${esc(interestLabel(e.interest))}</p>
      <p><strong>Name:</strong> ${esc(e.name)}${e.organisation ? ` (${esc(e.organisation)})` : ''}</p>
      <p><strong>Phone:</strong> ${esc(e.phone)}${e.email ? `<br /><strong>Email:</strong> ${esc(e.email)}` : ''}</p>
      <p style="white-space: pre-wrap;">${esc(e.message)}</p>
    </div>`;
  return sendGenericEmail(partnerEnquiryRecipient(), `EC partner enquiry: ${interestLabel(e.interest)}`, html);
}

// A simple per-address limit so the public form cannot be used to flood the inbox. It lives in
// this server's memory, so it resets on a restart; that is fine for a small public form.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export function tooManyEnquiries(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}
