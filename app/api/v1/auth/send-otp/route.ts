import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isValidAnyPhone, normalizeAnyPhone, ANY_PHONE_FORMAT_MESSAGE } from '@/lib/validation';
import {
  isOtpConfigured,
  generateOtp,
  hashOtp,
  sendWhatsAppOtp,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_S,
  OTP_SENDS_PER_WINDOW,
  OTP_SEND_WINDOW_MS,
} from '@/lib/otp';

const schema = z.object({ phone: z.string().min(10).max(20) });

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Sends a 6-digit sign-in code to the number's WhatsApp.
 *
 *  Replaces the old placeholder, which generated a code but never sent or stored
 *  it. Only sends to numbers that already have an account, and answers the same
 *  way whether or not they do, so this can't be used to find out who is
 *  registered — and no WhatsApp message is paid for on a random number. */
export async function POST(req: NextRequest) {
  if (!isOtpConfigured()) {
    return fail('OTP_NOT_AVAILABLE', 'Sign-in with a code is not available right now. Please use your password.', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidAnyPhone(parsed.data.phone)) {
    return fail('INVALID_PHONE', ANY_PHONE_FORMAT_MESSAGE, 400);
  }
  const phone = normalizeAnyPhone(parsed.data.phone);

  const now = Date.now();
  const recent = await prisma.loginOtp.findMany({
    where: { phone, createdAt: { gt: new Date(now - OTP_SEND_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const sinceLast = recent[0] ? (now - recent[0].createdAt.getTime()) / 1000 : Infinity;
  if (sinceLast < OTP_RESEND_COOLDOWN_S) {
    return fail('TOO_SOON', `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_S - sinceLast)} seconds before asking for another code.`, 429);
  }
  if (recent.length >= OTP_SENDS_PER_WINDOW) {
    return fail('TOO_MANY_REQUESTS', 'Too many codes requested. Please try again in a few minutes, or use your password.', 429);
  }

  const genericOk = NextResponse.json({
    success: true,
    data: {
      message: 'If this number has an account, a code is on its way on WhatsApp.',
      resendAfterSeconds: OTP_RESEND_COOLDOWN_S,
      expiresInSeconds: OTP_TTL_MS / 1000,
    },
  });

  // Same lookup shape as the password login — matches the canonical stored form
  // and the raw form some older accounts may still carry.
  const user = await prisma.user.findFirst({
    where: { OR: [{ phone }, { phone: parsed.data.phone.trim() }] },
    select: { id: true },
  });
  if (!user) return genericOk;

  // Only the newest code may ever verify.
  await prisma.loginOtp.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } });
  // Housekeeping: nothing older than a day is useful for anything.
  await prisma.loginOtp.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 3600_000) } } });

  const code = generateOtp();
  const record = await prisma.loginOtp.create({
    data: { phone, codeHash: hashOtp(code), expiresAt: new Date(now + OTP_TTL_MS) },
  });

  try {
    await sendWhatsAppOtp(phone, code);
  } catch (err) {
    console.error('[otp] send failed:', err instanceof Error ? err.message : err);
    await prisma.loginOtp.delete({ where: { id: record.id } }).catch(() => {});
    return fail('SEND_FAILED', 'We could not send the code right now. Please use your password, or try again shortly.', 502);
  }

  return genericOk;
}
