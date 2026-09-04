import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { dispatchNewsletter } from '@/lib/newsletter-dispatch';

/** Publishes now (regardless of any scheduledFor — there's no cron runner on
 *  this host to auto-fire a scheduled send, so an admin always triggers the
 *  actual dispatch explicitly) and sends it to the target audience via email +
 *  push in the same request. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  if (auth.role !== 'admin') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 });

  const { id } = await params;
  const newsletter = await prisma.newsletter.findUnique({ where: { id } });
  if (!newsletter) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Newsletter not found.' } }, { status: 404 });
  if (newsletter.status === 'published') {
    return NextResponse.json({ success: false, error: { code: 'ALREADY_PUBLISHED', message: 'This has already been published.' } }, { status: 400 });
  }

  const published = await prisma.newsletter.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
  });

  const result = await dispatchNewsletter(published);

  return NextResponse.json({ success: true, data: { newsletter: published, ...result } });
}
