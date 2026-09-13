import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { ok, invalidInput } from '@/lib/community-route';
import { getPrimaryNeighborhoodId } from '@/lib/community-access';

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

  // Rejected rows are excluded — a rejected join isn't a membership worth showing
  // here at all (re-joining creates a fresh pending row, see /community/join).
  // Pending rows ARE included so the UI can show "awaiting approval" instead of
  // either the full hub or the generic "join a community" empty state.
  const memberships = await prisma.neighborhoodMember.findMany({
    where: { userId: auth.userId, status: { in: ['approved', 'pending'] } },
    include: { neighborhood: true },
    orderBy: { createdAt: 'asc' },
  });
  const approved = memberships.filter((m) => m.status === 'approved');

  return ok({
    memberships: approved.map((m) => ({
      id: m.id,
      neighborhoodId: m.neighborhoodId,
      role: m.role,
      flatNumber: m.flatNumber,
      showInDirectory: m.showInDirectory,
      neighborhood: m.neighborhood,
    })),
    pendingMemberships: memberships
      .filter((m) => m.status === 'pending')
      .map((m) => ({ neighborhoodId: m.neighborhoodId, neighborhood: m.neighborhood })),
    primaryNeighborhoodId: approved[0]?.neighborhoodId ?? null,
  });
}

const patchSchema = z.object({
  neighborhoodId: z.string().optional(),
  showInDirectory: z.boolean(),
});

/** Self-service: a resident opts their own registered listing in/out of their
 *  community's "Your neighbours" directory. Distinct from Contact.shareWithNeighbours
 *  (opting a personal contact IN) — this is the flip side, opting the caller's own
 *  membership row out. No manage permission needed; it's their own row. */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const neighborhoodId = parsed.data.neighborhoodId || (await getPrimaryNeighborhoodId(auth.userId));
  if (!neighborhoodId) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_COMMUNITY', message: "You haven't joined a community yet." } },
      { status: 404 },
    );
  }

  const updated = await prisma.neighborhoodMember.update({
    where: { neighborhoodId_userId: { neighborhoodId, userId: auth.userId } },
    data: { showInDirectory: parsed.data.showInDirectory },
  });

  return ok({ neighborhoodId: updated.neighborhoodId, showInDirectory: updated.showInDirectory });
}
