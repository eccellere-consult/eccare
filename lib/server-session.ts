import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { isDeletedEmail } from '@/lib/account-deletion';

/** Reads and verifies the session cookie from a Server Component / layout. Use getAuthUser (lib/auth.ts) inside API route handlers instead. */
export async function getServerSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function getServerUser() {
  const session = await getServerSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user && isDeletedEmail(user.email) ? null : user;
}
