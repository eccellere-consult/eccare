import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Elder-facing read: every active admin-curated wellness video, any signed-in role. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const videos = await prisma.wellnessVideo.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true, youtubeUrl: true, description: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: videos });
}
