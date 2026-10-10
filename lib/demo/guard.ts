import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/session-token';
import { getDemoProtection, isAllowedWhileLocked } from './lock';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const DEMO_LOCKED_MESSAGE =
  'This is demo data and it is locked. Ask an admin to unlock it if you need to make changes.';

/** Middleware step for /api/v1/*: refuses any request that would change data when it comes
 *  from a demo login and the demo is locked. Everything else passes straight through.
 *  If the check itself fails for any reason it lets the request through — a problem here
 *  must never take down the app for real users. */
export async function demoGuard(req: NextRequest): Promise<NextResponse> {
  const next = NextResponse.next();
  if (READ_ONLY_METHODS.has(req.method)) return next;

  const { pathname } = req.nextUrl;
  if (isAllowedWhileLocked(pathname)) return next;

  const authHeader = req.headers.get('authorization');
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) || req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return next;

  try {
    const { userId } = await verifyToken(token);
    const protection = await getDemoProtection();
    if (protection.locked && protection.userIds.has(userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'DEMO_LOCKED', message: DEMO_LOCKED_MESSAGE } },
        { status: 403 },
      );
    }
  } catch {
    // Invalid token or a lookup failure: not this guard's business.
  }
  return next;
}
