import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser, comparePassword, clearSessionCookie } from '@/lib/auth';
import { deleteAccount, deletionBlockFor, isDeletedEmail } from '@/lib/account-deletion';

const schema = z.object({
  confirm: z.literal('DELETE'),
  password: z.string().optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** POST /api/v1/auth/delete-account — the signed-in person deletes their own account.
 *  Needs the word DELETE typed as confirmation, plus the password when the account has one. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Please type DELETE to confirm.', 400);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, role: true, email: true, passwordHash: true },
  });
  if (!user || isDeletedEmail(user.email)) return fail('NOT_FOUND', 'This account no longer exists.', 404);

  // The stored role decides (the auth helper reports an over-60 caregiver as a different role).
  const block = await deletionBlockFor(user.id, user.role);
  if (block) return fail(block.code, block.message, 409);

  if (user.passwordHash) {
    const ok = parsed.data.password ? await comparePassword(parsed.data.password, user.passwordHash) : false;
    if (!ok) return fail('INVALID_PASSWORD', 'That password is not correct.', 400);
  }

  try {
    await deleteAccount(user.id);
  } catch (err) {
    console.error('delete-account failed', err instanceof Error ? err.message : err);
    return fail(
      'SERVER_ERROR',
      'We could not delete the account just now. Nothing was changed. Please try again, or write to contact@eccare.in.',
      500,
    );
  }

  const res = NextResponse.json({ success: true, data: null });
  clearSessionCookie(res);
  return res;
}
