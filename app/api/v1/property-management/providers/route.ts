import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Verified Property Management providers an elder/family can browse and
 *  subscribe to directly — not community-scoped, so any logged-in user can
 *  see the full platform-wide list, same as Advisory experts. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const providers = await prisma.serviceProvider.findMany({
    where: { category: 'property_management', verificationStatus: 'verified' },
    include: { propertyManagementProfile: true },
    orderBy: { businessName: 'asc' },
  });

  const data = providers.map((p) => ({
    id: p.id,
    businessName: p.businessName,
    description: p.description,
    serviceArea: p.serviceArea,
    phone: p.phone,
    monthlyFee: p.propertyManagementProfile?.monthlyFee?.toString() ?? null,
    quarterlyFee: p.propertyManagementProfile?.quarterlyFee?.toString() ?? null,
    biannualFee: p.propertyManagementProfile?.biannualFee?.toString() ?? null,
  }));

  return NextResponse.json({ success: true, data });
}
