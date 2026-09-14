import { buildWaLink } from '@/lib/whatsapp';
import { renderTemplate } from '@/lib/whatsapp-templates-shared';

export interface WhatsAppRecipient {
  name: string;
  phone: string;
}

/** Same {{location}} substitution the admin-editable `emergency_help`
 *  template already uses — reused here rather than inventing a second SOS
 *  message, so there's still exactly one wording an admin can edit. */
export function buildSosMessage(template: string, lat?: number, lng?: number): string {
  const location = lat != null && lng != null ? ` My location: https://www.google.com/maps?q=${lat},${lng}` : '';
  return renderTemplate(template, { location });
}

/**
 * Opens the first recipient's WhatsApp chat immediately (the same one-tap
 * "Send" pattern already used for the Police button) and returns the rest
 * so the caller can render them as "notify the rest" buttons.
 *
 * There's no way to auto-chain further wa.me opens one after another with
 * no further taps: navigating to WhatsApp backgrounds this page, and a
 * browser only honors one new-window/app open per user gesture — every
 * link after the first needs its own tap regardless of how this function
 * is written. That's also why this is the "free" option (see the WhatsApp
 * delivery question this was built to) rather than a true unattended
 * multi-send, which needs a paid WhatsApp Business API.
 */
export function openFirstAndReturnRest(
  recipients: WhatsAppRecipient[],
  message: string,
): WhatsAppRecipient[] {
  if (recipients.length === 0) return [];
  const [first, ...rest] = recipients;
  window.open(buildWaLink(first.phone, message), '_blank');
  return rest;
}
