/**
 * Builds the number wa.me actually expects: full international format,
 * digits only, no leading +/00.
 *
 * Every phone number this app collects at registration is stored normalized
 * to a bare 10-digit Indian number (see lib/validation.ts's normalizePhone —
 * phone is the primary login identifier, so any +91/91/0 prefix is stripped
 * before storage). Every wa.me link in this app was built directly from that
 * bare 10-digit value with no country code prepended — wa.me silently shows
 * its own "invalid phone number" page instead of opening a chat when given
 * a 10-digit number, with nothing surfacing as an error anywhere in this
 * app, so the failure looked like "nothing happens" / "no message sent".
 *
 * This prepends 91 for a bare 10-digit number. Free-text phone fields not
 * covered by normalizePhone (LocalDoctor.phone, AutoDriver.phone/whatsapp,
 * ServiceProvider.phone, an admin-typed EmergencyContact number, etc.) pass
 * through unchanged if they're not exactly 10 digits after stripping — so a
 * number already entered with a country code isn't corrupted by this.
 */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/** wa.me deep link, with or without a pre-filled message. */
export function buildWaLink(phone: string, message?: string): string {
  const number = toWhatsAppNumber(phone);
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}
