import { SignJWT, jwtVerify } from 'jose';

// Edge-safe on purpose (jose only, no database): middleware.ts imports this, and
// the edge runtime can't load Prisma. Anything that needs the database lives in
// lib/auth.ts, which re-exports these.

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');

export const SESSION_COOKIE = 'ec_session';

export async function createToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string; role: string };
}
