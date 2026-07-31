import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';

const ROLE_HOME: Record<string, string> = {
  elder: '/elder',
  caregiver: '/family',
  admin: '/admin',
  provider: '/provider',
};

const PROTECTED_PREFIXES = ['/elder', '/family', '/admin', '/provider', '/community'];

/**
 * Which role a path is reserved for. `/community` deliberately returns null: it's
 * shared by elders and family members alike, so it requires a valid session but is
 * not locked to a single role. Membership itself is enforced per-request by the
 * community API routes (see lib/community-route.ts).
 */
function prefixRole(pathname: string): string | null {
  if (pathname.startsWith('/elder')) return 'elder';
  if (pathname.startsWith('/family')) return 'caregiver';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/provider')) return 'provider';
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifyToken(token);
    const requiredRole = prefixRole(pathname);
    if (requiredRole && payload.role !== requiredRole) {
      const home = ROLE_HOME[payload.role] ?? '/login';
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: [
    '/elder/:path*',
    '/family/:path*',
    '/admin/:path*',
    '/provider/:path*',
    '/community/:path*',
  ],
};
