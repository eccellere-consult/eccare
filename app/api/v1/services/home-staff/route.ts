import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isFeatureOn } from '@/lib/feature-switches';
import { STAFF_ROLES, isListed } from '@/lib/care-staff';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/**
 * The verified home-care staff catalogue for elders and families: only people EC has checked,
 * within their re-check date, with the rates EC approved. Never includes documents, Aadhaar
 * digits or expected salaries.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (!(await isFeatureOn('care_staff'))) return NextResponse.json({ success: true, data: { enabled: false, staff: [] } });

  const now = new Date();
  const rows = await prisma.careStaffListing.findMany({
    where: {
      status: 'approved',
      OR: [{ verifiedUntil: null }, { verifiedUntil: { gt: now } }],
      provider: { verificationStatus: 'verified' },
    },
    select: {
      id: true,
      personName: true,
      role: true,
      qualification: true,
      experienceYears: true,
      languages: true,
      about: true,
      verifiedUntil: true,
      reviewedAt: true,
      rates: { where: { approvedAmount: { not: null } }, select: { unit: true, approvedAmount: true, note: true } },
      provider: { select: { businessName: true, phone: true, serviceArea: true } },
    },
    orderBy: [{ reviewedAt: 'desc' }],
    take: 300,
  });

  const staff = rows
    .filter((r) => isListed({ status: 'approved', verifiedUntil: r.verifiedUntil, approvedRateCount: r.rates.length }, now))
    .filter((r) => STAFF_ROLES.some((s) => s.value === r.role))
    .map((r) => ({
      ...r,
      rates: r.rates.map((x) => ({ unit: x.unit, amount: Number(x.approvedAmount), note: x.note })),
    }));

  return NextResponse.json({ success: true, data: { enabled: true, staff } });
}
