import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Genuinely public — shown on the register page before anyone has an account,
 *  so this deliberately doesn't gate on auth like every other read route. */
export async function GET() {
  const videos = await prisma.helpGuideVideo.findMany({
    where: { isActive: true },
    select: { id: true, title: true, youtubeUrl: true, description: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, data: videos });
}
