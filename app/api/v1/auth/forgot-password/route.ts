import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import { createPasswordResetToken } from '@/lib/password-reset';

const schema = z.object({ email: z.string().email() });

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

  const resetUrl = await createPasswordResetToken(user.id, baseUrl(req));
  await sendPasswordResetEmail(user.email!, resetUrl);

  return genericResponse;
}
