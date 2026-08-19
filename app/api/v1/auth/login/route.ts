import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, comparePassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { z } from 'zod';
import { isValidPhone, normalizePhone } from '@/lib/validation';

// `email` is kept as a fallback field name (not just `identifier`) so an
// already-installed mobile app build — which still posts `{ email, password }` —
// keeps working until its next EAS update ships. New clients should send
// `identifier`, which can be a phone number or an email address.
const schema = z
  .object({
    identifier: z.string().min(1).optional(),
    email: z.string().min(1).optional(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
  })
  .refine((data) => !!(data.identifier || data.email), { message: 'Please enter your phone number or email.' });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter your phone number or email, and password.' } },
      { status: 400 },
    );
  }

  const { password, rememberMe = true } = parsed.data;
  const raw = (parsed.data.identifier ?? parsed.data.email ?? '').trim();

  // Phone lookup matches both the canonical normalized form (how new accounts are
  // stored) and the raw typed form (how some legacy accounts, stored before phone
  // login existed, may still be saved) — no data backfill needed for old rows.
  const user = isValidPhone(raw)
    ? await prisma.user.findFirst({ where: { OR: [{ phone: raw }, { phone: normalizePhone(raw) }] } })
    : await prisma.user.findUnique({ where: { email: raw } });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect phone/email or password.' } },
      { status: 401 },
    );
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect phone/email or password.' } },
      { status: 401 },
    );
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } });
  setSessionCookie(res, token, rememberMe);
  return res;
}
