import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runHealthAgent } from '@/lib/health-agent';

export const maxDuration = 300;

/** Called on a schedule by something outside the app (this host has no job runner): writes new DRAFTS for an
 *  admin to review. It never publishes. Protected by CRON_SECRET, sent as "Authorization: Bearer <secret>". */
function authorised(req: NextRequest): boolean | 'unset' {
  const secret = process.env.CRON_SECRET;
  if (!secret) return 'unset';
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  const ok = authorised(req);
  if (ok === 'unset') return NextResponse.json({ success: false, error: { code: 'NOT_CONFIGURED', message: 'CRON_SECRET is not set.' } }, { status: 503 });
  if (!ok) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Bad secret.' } }, { status: 401 });

  const count = Math.min(3, Math.max(1, Number(req.nextUrl.searchParams.get('count')) || 2));
  const results = await runHealthAgent({ count });
  return NextResponse.json({ success: true, data: { results } });
}

export const GET = handle;
export const POST = handle;
