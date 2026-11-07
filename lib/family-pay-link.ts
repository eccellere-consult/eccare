import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/db';
import { sendGenericEmail } from '@/lib/email';
import { toWhatsAppNumber } from '@/lib/whatsapp';

/**
 * The family plan is a digital subscription. Google Play does not let the
 * Android app lead people to a payment page, so inside the app the plan screen
 * shows no price and no link. Instead the server sends the person a message
 * OUTSIDE the app (email, and WhatsApp when it is set up) with a private link
 * to pay on the website. These helpers build and send that message.
 */

const PAY_LINK_DAYS = 7;
const GRAPH_VERSION = 'v21.0';

// A different key from the sign-in token (see lib/session-token.ts), so a pay
// link can never be used as a sign-in token, and the other way round.
function payKey(): Uint8Array {
  return new TextEncoder().encode(`${process.env.JWT_SECRET || 'dev-secret'}:family-pay`);
}

/** True when the request comes from the EC Android app (its web view adds "ECApp/1" to the browser id). */
export function isEcAppUserAgent(userAgent: string | null | undefined): boolean {
  return /\bECApp\//.test(userAgent ?? '');
}

export async function createPayToken(caregiverUserId: string): Promise<string> {
  return new SignJWT({ purpose: 'family-pay', cg: caregiverUserId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PAY_LINK_DAYS}d`)
    .sign(payKey());
}

/** The family member the link was made for, or null if it is forged, expired or for something else. */
export async function verifyPayToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, payKey());
    if (payload.purpose !== 'family-pay' || typeof payload.cg !== 'string') return null;
    return payload.cg;
  } catch {
    return null;
  }
}

export function payUrl(token: string): string {
  const base = (process.env.APP_URL || 'https://eccare.in').replace(/\/$/, '');
  return `${base}/pay/family?t=${encodeURIComponent(token)}`;
}

/** True only when a WhatsApp template for this message has been approved and its name set. */
export function isWhatsAppPayLinkConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PAYLINK_TEMPLATE,
  );
}

async function sendWhatsAppPayLink(phone: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toWhatsAppNumber(phone),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_PAYLINK_TEMPLATE,
          language: { code: process.env.WHATSAPP_PAYLINK_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: url }] }],
        },
      }),
    });
    if (!res.ok) {
      console.error('[pay-link] WhatsApp send failed:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[pay-link] WhatsApp send failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

function emailHtml(name: string, url: string): string {
  const safeName = name.replace(/[<>&"]/g, '');
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0B5563;">EC — Just Easy.</h1>
      <p>Hello ${safeName},</p>
      <p>Your family plan on EC needs a payment to start. Your elder's own account stays free.</p>
      <p>
        <a href="${url}" style="display: inline-block; background: #0B5563; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
          Choose a plan and pay
        </a>
      </p>
      <p>This private link works for ${PAY_LINK_DAYS} days. As soon as the payment goes through, open the EC app again and your family access is back.</p>
      <p style="color: #666; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br />${url}</p>
    </div>
  `;
}

export type PayLinkResult =
  | { ok: true; channels: Array<'email' | 'whatsapp'> }
  | { ok: false; reason: 'throttled' | 'not_found' | 'no_channel' | 'failed' };

/**
 * Sends the "how to pay" message to a family member, at most once per `minGapMs`.
 * Email goes when RESEND_API_KEY is set; WhatsApp goes when the Meta template
 * is configured (WHATSAPP_PAYLINK_TEMPLATE). Neither is required for the app
 * to work; with neither configured the result is `no_channel`.
 */
export async function sendFamilyPayLink(caregiverUserId: string, minGapMs: number): Promise<PayLinkResult> {
  const sub = await prisma.familySubscription.findUnique({
    where: { caregiverUserId },
    include: { caregiverUser: { select: { name: true, email: true, phone: true } } },
  });
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.payLinkSentAt && Date.now() - sub.payLinkSentAt.getTime() < minGapMs) return { ok: false, reason: 'throttled' };

  const { name, email, phone } = sub.caregiverUser;
  // A placeholder address left behind by account deletion is never a real inbox.
  const realEmail = email && !email.endsWith('@deleted.invalid') ? email : null;
  const url = payUrl(await createPayToken(caregiverUserId));

  const channels: Array<'email' | 'whatsapp'> = [];
  if (realEmail && (await sendGenericEmail(realEmail, 'Start your EC family plan', emailHtml(name ?? 'there', url)))) {
    channels.push('email');
  }
  if (phone && isWhatsAppPayLinkConfigured() && (await sendWhatsAppPayLink(phone, url))) {
    channels.push('whatsapp');
  }

  if (channels.length === 0) return { ok: false, reason: realEmail || phone ? 'failed' : 'no_channel' };
  await prisma.familySubscription.update({ where: { id: sub.id }, data: { payLinkSentAt: new Date() } });
  return { ok: true, channels };
}
