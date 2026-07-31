import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const relations = await prisma.familyRelation.findMany({
    where: { caregiverUserId: auth.userId },
    include: { elderUser: true },
    orderBy: { createdAt: 'desc' },
  });

  const safeRelations = relations.map((r) => ({ ...r, elderUser: toSafeUser(r.elderUser) }));
  return NextResponse.json({ success: true, data: safeRelations });
}
