import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    select: { id: true, title: true, bodyHtml: true, excerpt: true, publishedAt: true, status: true },
  });

  if (!newsletter || newsletter.status !== 'published') {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Newsletter not found.' } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: newsletter });
}
