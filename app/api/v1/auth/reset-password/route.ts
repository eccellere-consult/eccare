import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return fail('INVALID_INPUT', 'Please enter a new password of at least 8 characters.', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  // Deliberately the same generic error for "doesn't exist", "already used", and
  // "expired" — no reason to tell a caller which one it is.
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return fail('INVALID_TOKEN', 'This reset link is invalid or has expired. Please request a new one.', 400);
  }

  const newHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash: newHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    // Any other outstanding tokens for this user are now stale too — burn them so a
    // second unused link from an earlier request can't also reset the password later.
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
    }),
  ]);

  return NextResponse.json({ success: true, data: null });
}
