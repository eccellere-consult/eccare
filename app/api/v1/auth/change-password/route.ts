import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser, hashPassword, comparePassword } from '@/lib/auth';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return fail('INVALID_INPUT', 'Please enter your current password and a new password of at least 8 characters.', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return fail('NOT_FOUND', 'User not found.', 404);

  if (!user.passwordHash) {
    return fail('NO_PASSWORD_SET', "This account doesn't have a password set yet. Please contact support.", 409);
  }

  const matches = await comparePassword(parsed.data.currentPassword, user.passwordHash);
  if (!matches) return fail('INVALID_PASSWORD', 'Current password is incorrect.', 400);

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: auth.userId }, data: { passwordHash: newHash } });

  return NextResponse.json({ success: true, data: null });
}
