import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ok } from '@/lib/community-route';

/** The caller's communities and their role in each. Drives whether the UI shows the
 *  community section or the "join a community" prompt. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const memberships = await prisma.neighborhoodMember.findMany({
    where: { userId: auth.userId },
    include: { neighborhood: true },
    orderBy: { createdAt: 'asc' },
  });

  return ok({
    memberships: memberships.map((m) => ({
      role: m.role,
      flatNumber: m.flatNumber,
      showInDirectory: m.showInDirectory,
      neighborhood: m.neighborhood,
    })),
    primaryNeighborhoodId: memberships[0]?.neighborhoodId ?? null,
  });
}
