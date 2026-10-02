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

// ─── International numbers (family members / caregivers abroad) ──────────────
//
// Elders, providers and everything local stay India-only (isValidPhone /
// normalizePhone above, unchanged). Family members often live in the Gulf,
// Singapore, Europe or the US, so sign-up and sign-in also accept an
// international number, stored in a form that can never be confused with an
// Indian one: "+" followed by country code and number (E.164), e.g.
// "+6591234567". An Indian number stays the bare 10 digits it has always been,
// so no existing row needs migrating.
//
// +91 is deliberately excluded here — a "+91…" number is Indian and goes through
// the existing path, so there is exactly one stored form per number.

const INTL_PHONE_RE = /^\+(?!91)[1-9]\d{6,14}$/;

function stripPhoneFormatting(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

export function isValidInternationalPhone(phone: string): boolean {
  return INTL_PHONE_RE.test(stripPhoneFormatting(phone));
}

/** True for an Indian OR an international number. */
export function isValidAnyPhone(phone: string): boolean {
  return isValidPhone(phone) || isValidInternationalPhone(phone);
}

/** True when the number is valid but not Indian — i.e. needs a family account. */
export function isInternationalPhone(phone: string): boolean {
  return isValidInternationalPhone(phone);
}

/** Canonical stored form: bare 10 digits for India, "+<country code><number>"
 *  for everywhere else. Only call after isValidAnyPhone(). */
export function normalizeAnyPhone(phone: string): string {
  return isValidInternationalPhone(phone) ? stripPhoneFormatting(phone) : normalizePhone(phone);
}

export const ANY_PHONE_FORMAT_MESSAGE =
  'Please enter a valid mobile number — 10 digits for India, or with your country code (like +65 9123 4567) from abroad.';
export const INTERNATIONAL_ROLE_MESSAGE =
  'A number outside India can only be used for a family account. Elders and service providers need an Indian mobile number.';
