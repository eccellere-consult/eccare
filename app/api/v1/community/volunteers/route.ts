import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Directory of active, verified volunteers who are members of the caller's own
 *  community — "geo-filtered" here means scoped by community/neighborhood
 *  membership, the same boundary every other "local" directory in this app uses
 *  (Doctors, Auto Drivers, Vendors), since that's the actual geographic
 *  granularity the rest of the platform works at. Pending/rejected volunteers
 *  never appear here — only what's already been through admin/committee review.
 *  Optional ?availability= and ?assistanceType= narrow the list further. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const availability = req.nextUrl.searchParams.get('availability');
  const assistanceType = req.nextUrl.searchParams.get('assistanceType');
  const search = req.nextUrl.searchParams.get('search')?.trim();

  const members = await prisma.neighborhoodMember.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);

  const volunteers = await prisma.volunteerProfile.findMany({
    where: {
      userId: { in: memberIds },
      isActive: true,
      verificationStatus: 'verified',
      ...(availability ? { availability: availability as 'weekdays' | 'weekends' | 'always' } : {}),
      ...(search ? { user: { name: { contains: search } } } : {}),
    },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // assistanceTypes is a JSON array column — filtered in application code rather
  // than a DB query, since MySQL JSON "array contains" filtering through Prisma
  // isn't available the same way a relational column would be, and this list is
  // small enough per community that it doesn't need to be.
  const filtered = assistanceType
    ? volunteers.filter((v) => Array.isArray(v.assistanceTypes) && (v.assistanceTypes as string[]).includes(assistanceType))
    : volunteers;

  return ok(filtered);
}
