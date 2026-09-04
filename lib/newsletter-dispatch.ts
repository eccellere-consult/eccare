import { prisma } from '@/lib/db';
import { sendGenericEmail } from '@/lib/email';
import { sendPushToTokens } from '@/lib/fcm';
import type { Newsletter, NewsletterAudience } from '@prisma/client';

/** Resolves a target audience into the actual users to reach — 'everyone' is
 *  every user regardless of role; the others map onto the existing role/
 *  volunteer-registration fields rather than needing a new segmentation model. */
async function resolveAudience(audience: NewsletterAudience) {
  if (audience === 'all_caregivers') {
    return prisma.user.findMany({ where: { role: 'caregiver' }, include: { deviceTokens: true } });
  }
  if (audience === 'all_elders') {
    return prisma.user.findMany({ where: { role: 'elder' }, include: { deviceTokens: true } });
  }
  if (audience === 'all_volunteers') {
    return prisma.user.findMany({
      where: { volunteerProfile: { verificationStatus: 'verified' } },
      include: { deviceTokens: true },
    });
  }
  return prisma.user.findMany({ include: { deviceTokens: true } });
}

/** Sends one newsletter to its target audience via email (Resend) and push
 *  (FCM) — the same two providers already used throughout this app, no new
 *  integration. Both legs degrade gracefully (no-op, not throw) if their
 *  respective API key isn't configured, same as every other email/push send
 *  here. Returns counts so the admin UI can show what actually went out. */
export async function dispatchNewsletter(newsletter: Newsletter): Promise<{ emailsSent: number; pushSent: number; recipients: number }> {
  const users = await resolveAudience(newsletter.audience);

  let emailsSent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const ok = await sendGenericEmail(
      user.email,
      newsletter.title,
      `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h1 style="color: #0B5563;">EC — Just Easy.</h1>
          <h2 style="color: #052E36;">${newsletter.title}</h2>
          <div style="color: #052E36; line-height: 1.6;">${newsletter.bodyHtml}</div>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">
            You're receiving this because you're part of the EC community.
          </p>
        </div>
      `,
    );
    if (ok) emailsSent++;
  }

  const tokens = [...new Set(users.flatMap((u) => u.deviceTokens.map((d) => d.token)))];
  const pushResult = tokens.length
    ? await sendPushToTokens(tokens, {
        title: newsletter.title,
        body: newsletter.excerpt || 'New from EC — tap to read.',
        // 'default', not a new 'newsletter' channel — Android notification
        // channels have to be pre-registered on the mobile app side (expo-
        // notifications) before they'll actually surface a notification, and
        // this dispatch pipeline doesn't touch the mobile app.
        channelId: 'default',
        data: { type: 'newsletter', newsletterId: newsletter.id },
      })
    : { sent: 0 };

  return { emailsSent, pushSent: pushResult.sent, recipients: users.length };
}
