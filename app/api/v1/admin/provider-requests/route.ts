import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** All provider-community connection requests, across every community — platform
 *  admin's queue. Only `communityApproved` ones are actionable (see the PATCH route),
 *  but the full list is shown for visibility into what's still pending locally. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }
  if (auth.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } },
      { status: 403 },
    );
  }

  const requests = await prisma.communityProviderListing.findMany({
    include: {
      provider: {
        select: { id: true, businessName: true, category: true, user: { select: { name: true, email: true } } },
      },
      neighborhood: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: requests });
}
