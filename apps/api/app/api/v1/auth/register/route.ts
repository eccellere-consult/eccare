import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, hashPassword, setSessionCookie } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'provider']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please check your details and try again.' } },
      { status: 400 },
    );
  }

  const { email, password, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role },
  });

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user, token } }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
