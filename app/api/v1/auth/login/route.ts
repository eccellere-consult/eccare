import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, comparePassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter your email and password.' } },
      { status: 400 },
    );
  }

  const { email, password, rememberMe = true } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } },
      { status: 401 },
    );
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } },
      { status: 401 },
    );
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } });
  setSessionCookie(res, token, rememberMe);
  return res;
}
