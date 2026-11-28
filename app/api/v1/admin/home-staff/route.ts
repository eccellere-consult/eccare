import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { fail, LISTING_INCLUDE, serialiseListing } from '@/lib/care-staff-server';

/** Every home-care staff listing for EC to check, newest-waiting first, with the provider. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const [enabled, listings] = await Promise.all([
    isFeatureOn('care_staff'),
    prisma.careStaffListing.findMany({
      where: { status: { not: 'draft' } },
      include: {
        ...LISTING_INCLUDE,
        provider: {
          select: { id: true, businessName: true, phone: true, verificationStatus: true, serviceArea: true, user: { select: { name: true, email: true, phone: true } } },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
  ]);
  return NextResponse.json({ success: true, data: { enabled, listings: listings.map(serialiseListing) } });
}
