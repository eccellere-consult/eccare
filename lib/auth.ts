import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');

export const SESSION_COOKIE = 'ec_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches JWT expiry below

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

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, 10);
}

export async function comparePin(pin: string, hashed: string): Promise<boolean> {
  return compare(pin, hashed);
}

export const hashPassword = hashPin;
export const comparePassword = comparePin;

/**
 * Sets the httpOnly session cookie used by the web app's middleware. Mobile ignores
 * this and uses the Bearer token instead.
 *
 * `persistent` (default true) controls whether the cookie survives closing the
 * browser: true sets `maxAge` (30 days, matching the JWT's own expiry) so the device
 * stays signed in; false omits `maxAge` entirely, making it a session cookie the
 * browser discards on close. Defaulting to true favors staying signed in, since the
 * primary users are elders for whom repeated re-authentication is a real burden, not
 * just an inconvenience.
 */
export function setSessionCookie(res: NextResponse, token: string, persistent: boolean = true) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(persistent ? { maxAge: SESSION_MAX_AGE } : {}),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.delete(SESSION_COOKIE);
}

/** Strips secret fields before a user record is ever sent to the client. */
export function toSafeUser<T extends { passwordHash?: unknown; pinHash?: unknown }>(
  user: T,
): Omit<T, 'passwordHash' | 'pinHash'> {
  const { passwordHash, pinHash, ...safe } = user;
  return safe;
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = bearerToken || req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
