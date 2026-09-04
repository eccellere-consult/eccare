import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Public archive listing — every published newsletter, newest first. Genuinely
 *  unauthenticated, same reasoning as GET /api/v1/help-guides: a public archive
 *  page shouldn't require an account to browse. */
export async function GET() {
  const newsletters = await prisma.newsletter.findMany({
    where: { status: 'published' },
    select: { id: true, title: true, excerpt: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: newsletters });
}
