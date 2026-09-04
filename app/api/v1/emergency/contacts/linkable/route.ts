import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Candidates for the Emergency Contact Matrix — the elder's own linked family
 *  (caregivers with an accepted FamilyRelation) plus verified volunteers in the
 *  same community/neighborhood the elder belongs to. Excludes whoever's already
 *  linked, so the picker only ever shows people you could actually still add. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's contacts.", 403);
  }

  const [alreadyLinked, familyRelations, neighborhoodMembership] = await Promise.all([
    prisma.emergencyContact.findMany({ where: { userId: elderUserId, linkedUserId: { not: null } }, select: { linkedUserId: true } }),
    prisma.familyRelation.findMany({
      where: { elderUserId, inviteStatus: 'accepted' },
      include: { caregiverUser: { select: { id: true, name: true, phone: true, role: true } } },
    }),
    prisma.neighborhoodMember.findFirst({ where: { userId: elderUserId }, select: { neighborhoodId: true } }),
  ]);

  const excludeIds = new Set(alreadyLinked.map((c) => c.linkedUserId));

  const family = familyRelations
    .map((r) => ({ ...r.caregiverUser, kind: 'family' as const, relationship: r.relationship }))
    .filter((u) => !excludeIds.has(u.id));

  let volunteers: { id: string; name: string; phone: string | null; kind: 'volunteer'; relationship: string }[] = [];
  if (neighborhoodMembership) {
    const members = await prisma.neighborhoodMember.findMany({
      where: { neighborhoodId: neighborhoodMembership.neighborhoodId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId).filter((id) => !excludeIds.has(id) && id !== elderUserId);
    const profiles = await prisma.volunteerProfile.findMany({
      where: { userId: { in: memberIds }, isActive: true, verificationStatus: 'verified' },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
    volunteers = profiles.map((p) => ({ ...p.user, kind: 'volunteer' as const, relationship: 'Community volunteer' }));
  }

  return NextResponse.json({ success: true, data: [...family, ...volunteers] });
}
