import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { toWhatsAppNumber } from '@/lib/whatsapp';

export const OTP_TTL_MS = 5 * 60_000; // a code is good for 5 minutes
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code
export const OTP_RESEND_COOLDOWN_S = 30; // matches the login page's resend countdown
export const OTP_SENDS_PER_WINDOW = 3; // per phone...
export const OTP_SEND_WINDOW_MS = 10 * 60_000; // ...per 10 minutes

const GRAPH_VERSION = 'v21.0';

/** True only when the WhatsApp Cloud API credentials are set. The login page
 *  hides the "sign in with a WhatsApp code" option when this is false, so this
 *  can ship before the Meta account/template exists without breaking login. */
export function isOtpConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

// HMAC (keyed with the app secret) rather than a bare hash: a 6-digit code has
// only a million possibilities, so a plain SHA-256 of it would be trivially
// reversible if the table ever leaked.
export function hashOtp(code: string): string {
  return createHmac('sha256', process.env.JWT_SECRET || 'dev-secret').update(code).digest('hex');
}

export function otpMatches(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sends the code through an approved WhatsApp "authentication" template (Meta
 *  Cloud API). Authentication templates carry a one-tap "Copy code" button,
 *  which is what the login page's auto-fill picks up from the clipboard.
 *  Throws on any failure so the caller can discard the stored code. */
export async function sendWhatsAppOtp(phone: string, code: string): Promise<void> {
  const template = process.env.WHATSAPP_OTP_TEMPLATE || 'ec_login_code';
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en';

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toWhatsAppNumber(phone), // bare 10 digits => +91; "+<cc>…" is already international
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            // The Copy-code button's parameter is the same code — required for
            // authentication templates.
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WhatsApp send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
