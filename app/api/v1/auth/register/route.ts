import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, hashPassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['elder', 'caregiver']),
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
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  let user;
  if (existing) {
    // A family member may have already invited this person, which creates an
    // unclaimed placeholder (no passwordHash). Claim it instead of rejecting.
    if (existing.passwordHash) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } },
        { status: 409 },
      );
    }
    if (existing.role !== role) {
      return NextResponse.json(
        { success: false, error: { code: 'ROLE_MISMATCH', message: 'This email was already invited with a different role.' } },
        { status: 409 },
      );
    }
    user = await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, name } });
  } else {
    user = await prisma.user.create({ data: { email, passwordHash, name, role } });
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
