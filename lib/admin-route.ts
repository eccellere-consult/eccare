import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/** Platform-admin gate for an API route: `{ error }` is a ready response, otherwise `{ auth }`. */
export async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export const apiError = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export const apiOk = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });
