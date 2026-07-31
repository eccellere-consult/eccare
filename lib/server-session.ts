import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';

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

  return prisma.user.findUnique({ where: { id: session.userId } });
}
