import { Resend } from 'resend';

// Lazily instantiated — same reasoning as lib/razorpay.ts / lib/claude.ts: a
// module-top-level `new Resend(...)` would capture process.env at import time,
// before env vars are guaranteed loaded.
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/** "EC <no-reply@eccare.in>" style sender — falls back to Resend's own shared
 *  onboarding domain if the user hasn't verified eccare.in with Resend yet, so
 *  email sending still works (just from a resend.dev address) during setup. */
function fromAddress(): string {
  return process.env.EMAIL_FROM || 'EC <onboarding@resend.dev>';
}

/** Sends the password-reset email. No-ops (logs and returns false) if RESEND_API_KEY
 *  isn't configured yet, rather than throwing — mirrors how voice/push features
 *  degrade gracefully without their optional API keys elsewhere in this app. Callers
 *  must still return a generic success response to the client either way, so a
 *  missing key doesn't leak which emails are registered. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping password reset email send.', { to, resetUrl });
    return false;
  }

  const { error } = await client.emails.send({
    from: fromAddress(),
    to,
    subject: 'Reset your EC password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="color: #0B5563;">EC — Just Easy.</h1>
        <p>We got a request to reset the password on your EC account.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #0B5563; color: #fff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p>This link works for 1 hour. If you didn't ask for this, you can safely ignore this email — your password won't change.</p>
        <p style="color: #666; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br />${resetUrl}</p>
      </div>
    `,
  });

  if (error) {
    console.error('[email] Resend send failed:', error);
    return false;
  }
  return true;
}
