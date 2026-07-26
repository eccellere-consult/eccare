import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, setSessionCookie } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
  name: z.string().min(1).optional(),
  role: z.enum(['elder', 'caregiver']).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid phone or OTP.' } },
      { status: 400 },
    );
  }

  const { phone, otp, name, role } = parsed.data;

  // TODO: Verify OTP against stored value
  // For development, accept 123456
  if (process.env.NODE_ENV !== 'production' && otp !== '123456') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_OTP', message: 'The OTP you entered is incorrect.' } },
      { status: 401 },
    );
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        name: name || 'User',
        role: role || 'elder',
      },
    });
  }

  const token = await createToken(user.id, user.role);

  const res = NextResponse.json({
    success: true,
    data: { user, token },
  });
  setSessionCookie(res, token);
  return res;
}
