import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Active advisors, any signed-in user — optionally filtered by ?category=. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });

  const category = req.nextUrl.searchParams.get('category');
  const validCategories = ['legal_will', 'reverse_mortgage', 'senior_insurance'] as const;

  const experts = await prisma.advisoryExpert.findMany({
    where: {
      isActive: true,
      ...(category && (validCategories as readonly string[]).includes(category)
        ? { category: category as (typeof validCategories)[number] }
        : {}),
    },
    select: { id: true, category: true, name: true, firmName: true, phone: true, email: true, bio: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ success: true, data: experts });
}
