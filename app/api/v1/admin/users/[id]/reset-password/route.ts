import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createPasswordResetToken } from '@/lib/password-reset';

function baseUrl(req: NextRequest): string {
  return process.env.APP_URL || req.nextUrl.origin;
}

/** Admin-only manual reset — the self-serve "forgot password" flow only works for
 *  accounts with an email (it sends the link there). Phone-primary accounts with
 *  no email have no self-serve path, so this generates the same reset link and
 *  hands it back to the admin directly (instead of emailing it) to relay by phone
 *  call, WhatsApp, or however they'd normally reach that person. Reuses the exact
 *  same PasswordResetToken flow — the resulting link works identically either way. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only platform admins can do this.' } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } },
      { status: 404 },
    );
  }
  if (!user.passwordHash) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_CLAIMED', message: "This account hasn't been claimed yet — there's no password to reset." } },
      { status: 409 },
    );
  }

  const resetUrl = await createPasswordResetToken(user.id, baseUrl(req));
  return NextResponse.json({ success: true, data: { resetUrl } });
}
