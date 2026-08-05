import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

/** Provider connection requests awaiting this community's own approval —
 *  committee/admin only, same gate as every other manage-tier community route. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const requests = await prisma.communityProviderListing.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: {
      provider: {
        select: {
          id: true,
          businessName: true,
          category: true,
          serviceArea: true,
          phone: true,
          verificationStatus: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(requests);
}
