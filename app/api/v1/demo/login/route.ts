import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createToken, setSessionCookie, toSafeUser } from '@/lib/auth';
import { getDemoProtection } from '@/lib/demo/lock';
import { DEMO_PERSONAS } from '@/lib/demo/personas';

const schema = z.object({ persona: z.enum(['elder']) });

// A light brake against hammering this public endpoint: 20 sign-ins a minute per address.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

/** One-click sign-in as the demo elder, with no password. Only works while the
 *  demo is loaded, only for that one account, and the session lasts until the browser is
 *  closed. While the demo is locked those accounts cannot change anything (lib/demo/guard.ts). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (tooMany(ip)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Please wait a minute and try again.' } }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Choose the elder demo.' } }, { status: 400 });
  }

  const protection = await getDemoProtection();
  const persona = DEMO_PERSONAS.find((p) => p.id === parsed.data.persona)!;
  const user = protection.loaded ? await prisma.user.findUnique({ where: { email: persona.email } }) : null;
  if (!user || user.role === 'admin') {
    return NextResponse.json({ success: false, error: { code: 'DEMO_UNAVAILABLE', message: 'The demo is not available right now.' } }, { status: 404 });
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user) } });
  setSessionCookie(res, token, false); // a session cookie: it ends when the browser is closed
  return res;
}
