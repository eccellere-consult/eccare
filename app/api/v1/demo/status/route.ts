import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDemoProtection } from '@/lib/demo/lock';

/** Tells the signed-in user whether they are on a demo login and whether it is currently
 *  read-only, so the app can show a short notice. Reveals nothing else. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }
  const protection = await getDemoProtection();
  const demoAccount = protection.userIds.has(auth.userId);
  const unlockedUntil =
    demoAccount && protection.unlockedUntil && protection.unlockedUntil.getTime() > Date.now()
      ? protection.unlockedUntil.toISOString()
      : null;
  return NextResponse.json({ success: true, data: { demoAccount, locked: demoAccount && protection.locked, unlockedUntil } });
}
