import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createToken, setSessionCookie, toSafeUser } from '@/lib/auth';
import { isValidAnyPhone, normalizeAnyPhone } from '@/lib/validation';
import { isOtpConfigured, otpMatches, OTP_MAX_ATTEMPTS } from '@/lib/otp';

const schema = z.object({
  phone: z.string().min(10).max(20),
  otp: z.string().regex(/^\d{6}$/),
  rememberMe: z.boolean().optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const WRONG_CODE = 'That code is incorrect or has expired. Please try again or ask for a new one.';

/** Signs a user in with the 6-digit code sent to their WhatsApp.
 *
 *  Replaces the old placeholder, which in production skipped the code check
 *  entirely (any 6 digits signed in as any phone number, creating the account if
 *  it didn't exist, and returned the full user record including password hash).
 *  Sign-in only: this never creates an account, and returns toSafeUser(). */
export async function POST(req: NextRequest) {
  if (!isOtpConfigured()) {
    return fail('OTP_NOT_AVAILABLE', 'Sign-in with a code is not available right now. Please use your password.', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidAnyPhone(parsed.data.phone)) return fail('INVALID_INPUT', WRONG_CODE, 400);

  const { otp, rememberMe = true } = parsed.data;
  const phone = normalizeAnyPhone(parsed.data.phone);

  const record = await prisma.loginOtp.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return fail('INVALID_OTP', WRONG_CODE, 401);

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return fail('TOO_MANY_ATTEMPTS', 'Too many wrong tries. Please ask for a new code.', 429);
  }

  if (!otpMatches(otp, record.codeHash)) {
    await prisma.loginOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return fail('INVALID_OTP', WRONG_CODE, 401);
  }

  // Single-use: the conditional update means two simultaneous requests with the
  // right code can't both succeed.
  const consumed = await prisma.loginOtp.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return fail('INVALID_OTP', WRONG_CODE, 401);

  const user = await prisma.user.findFirst({
    where: { OR: [{ phone }, { phone: parsed.data.phone.trim() }] },
  });
  if (!user) {
    return fail('NO_ACCOUNT', 'No account found for this number. Please create an account first.', 404);
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } });
  setSessionCookie(res, token, rememberMe);
  return res;
}
