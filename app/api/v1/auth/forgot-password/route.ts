import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

const schema = z.object({ email: z.string().email() });

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function baseUrl(req: NextRequest): string {
  // Prefer an explicit configured URL (production, behind a reverse proxy) — falls
  // back to the request's own origin for local dev.
  return process.env.APP_URL || req.nextUrl.origin;
}

/** Always returns the same generic success response, whether or not the email is
 *  registered — this is deliberate, not an oversight: telling an attacker "that
 *  email doesn't exist" vs "we sent a link" is exactly how account enumeration
 *  attacks work. The client-visible behavior is identical either way. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter a valid email address.' } },
      { status: 400 },
    );
  }

  const genericResponse = NextResponse.json({
    success: true,
    data: { message: "If that email is registered with EC, we've sent a password reset link to it." },
  });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // No account, or an unclaimed placeholder (created by a family invite, no
  // password ever set) — nothing to reset. Same generic response either way.
  if (!user || !user.passwordHash) return genericResponse;

  // Invalidate any earlier outstanding tokens for this user before issuing a new
  // one — avoids a stale link from an earlier request still being usable.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${baseUrl(req)}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email!, resetUrl);

  return genericResponse;
}
