import crypto from 'crypto';
import Razorpay from 'razorpay';

// Lazily instantiated — matches the fix applied to lib/claude.ts earlier: a
// module-top-level `new Razorpay(...)` would capture process.env at import time,
// before env vars are guaranteed loaded.
function getClient(): Razorpay {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/** Creates a Razorpay order for a rupee amount (converts to paise, Razorpay's unit).
 *  `receipt` is our own Order.id, so Razorpay's dashboard cross-references back. */
export async function createRazorpayOrder(amountRupees: number, receipt: string) {
  const client = getClient();
  return client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
  });
}

/** Verifies a Checkout success callback server-side — Razorpay's documented
 *  recipe: HMAC-SHA256 of "{order_id}|{payment_id}" signed with the key secret must
 *  match what the client received. Never trust a "payment succeeded" claim from the
 *  client without this. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/** Verifies a Razorpay webhook request against the raw request body — must be the
 *  untouched raw string, not a re-serialized JSON.parse'd-then-stringify'd copy, or
 *  the signature won't match. Uses the SDK's own exported helper. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}
