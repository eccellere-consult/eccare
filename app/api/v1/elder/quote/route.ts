import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getTodaysQuote } from '@/lib/daily-quote';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const quote = await getTodaysQuote();
  return NextResponse.json({ success: true, data: quote ?? { text: null, author: null } });
}
