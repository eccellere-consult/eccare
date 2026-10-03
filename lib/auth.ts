import { hash, compare } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCaregiverEligible } from '@/lib/age';
import { verifyToken, createToken, SESSION_COOKIE } from '@/lib/session-token';

// Token creation/verification lives in lib/session-token.ts (edge-safe, so the
// middleware can use it without dragging Prisma into the edge bundle); re-exported
// here so every existing `from '@/lib/auth'` import keeps working.
export { verifyToken, createToken, SESSION_COOKIE };

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches the JWT expiry in session-token.ts

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

/** The role an account holds once the age rule is applied. A caregiver whose date
 *  of birth says 60 or over (and who has no admin exception) is reported as
 *  'caregiver_ineligible' — which matches no role check anywhere, so every
 *  caregiver-only route refuses them without each one needing to know about ages.
 *  Accounts with no date of birth yet are left alone (see isCaregiverEligible). */
export const INELIGIBLE_CAREGIVER_ROLE = 'caregiver_ineligible';

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = bearerToken || req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (payload.role === 'caregiver') {
      // One primary-key lookup, only for caregivers. Read fresh (not baked into
      // the 30-day token) so an admin exception or a newly entered date of birth
      // takes effect immediately.
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { dateOfBirth: true, caregiverException: true },
      });
      if (user && !isCaregiverEligible(user)) return { ...payload, role: INELIGIBLE_CAREGIVER_ROLE };
    }
    return payload;
  } catch {
    return null;
  }
}
