/** Shared email/phone format validation — used by registration and profile edit
 *  on both the server (source of truth) and client (fast feedback before submit).
 *
 *  This checks *format* only, not that the address/number is reachable — real
 *  verification (OTP or a confirmation link) needs an SMS/email provider decision
 *  first, same as the already-flagged OTP gap. See the backlog card. */

// RFC 5322 is famously hard to fully validate with a regex; this catches the
// realistic mistakes (missing @, no domain, stray spaces) without being so strict
// it rejects valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// India-only per the project's design ethos (₹, +91 conventions). Accepts an
// optional +91/91/0 prefix, then a 10-digit mobile number starting 6-9. Spaces and
// hyphens are stripped before checking, so "98765 43210" and "9876-543-210" both
// validate the same as "9876543210".
const PHONE_RE = /^(?:\+91|91|0)?[6-9]\d{9}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/[\s-]/g, ''));
}

// Canonical stored/matched form: bare 10-digit number, no country-code prefix, no
// spaces/hyphens. Phone is now the primary login identifier (see registration and
// login), so "+91 98765 43210", "919876543210", "09876543210", and "9876543210"
// all need to resolve to the same account — without this, two people who typed the
// same number in different formats would silently get treated as different phones.
// Only call this after isValidPhone() has confirmed the input is well-formed.
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '').replace(/^(?:\+91|91|0)/, '');
}

export const EMAIL_FORMAT_MESSAGE = 'Please enter a valid email address.';
export const PHONE_FORMAT_MESSAGE = 'Please enter a valid 10-digit Indian mobile number.';
