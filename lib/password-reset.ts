import crypto from 'crypto';
import { prisma } from '@/lib/db';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Shared by the self-serve "forgot password" flow (which emails the link) and
 *  the admin manual-reset tool (which hands the link to the admin to relay by
 *  phone/WhatsApp for accounts with no email). Invalidates any earlier
 *  outstanding tokens for the user first, so a stale link can't still be used
 *  once a new one is issued. */
export async function createPasswordResetToken(userId: string, baseUrl: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return `${baseUrl}/reset-password?token=${rawToken}`;
}
