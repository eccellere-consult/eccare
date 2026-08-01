import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

interface HealthGuard {
  userId: string;
  role: string;
  elderUserId: string;
  canManageMeds: boolean;
}

/**
 * Authorize access to an elder's health data.
 *
 * - If the caller IS the elder, they can view everything but not manage meds.
 * - If the caller is a caregiver with an accepted FamilyRelation to this elder
 *   and canViewHealth is true, they can view. If canManageMeds is also true they
 *   can create/update medications.
 * - Admins can view any elder's data (read-only, no med management).
 *
 * `elderUserId` comes from a route param or query string — the caller explicitly
 * says whose data they want. When omitted and the caller is an elder, it defaults
 * to their own data.
 */
export async function requireHealthAccess(
  req: NextRequest,
  elderUserIdParam?: string | null,
): Promise<HealthGuard | NextResponse> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  let elderUserId = elderUserIdParam || req.nextUrl.searchParams.get('elderUserId');

  if (user.role === 'elder') {
    if (elderUserId && elderUserId !== user.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own health data.' } },
        { status: 403 },
      );
    }
    return { userId: user.userId, role: 'elder', elderUserId: user.userId, canManageMeds: false };
  }

  if (user.role === 'admin') {
    if (!elderUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'elderUserId is required.' } },
        { status: 400 },
      );
    }
    return { userId: user.userId, role: 'admin', elderUserId, canManageMeds: false };
  }

  if (user.role === 'caregiver') {
    if (!elderUserId) {
      const firstRelation = await prisma.familyRelation.findFirst({
        where: { caregiverUserId: user.userId, inviteStatus: 'accepted', canViewHealth: true },
        select: { elderUserId: true },
      });
      elderUserId = firstRelation?.elderUserId ?? null;
    }
    if (!elderUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'elderUserId is required.' } },
        { status: 400 },
      );
    }
    const relation = await prisma.familyRelation.findUnique({
      where: { elderUserId_caregiverUserId: { elderUserId, caregiverUserId: user.userId } },
    });
    if (!relation || relation.inviteStatus !== 'accepted' || !relation.canViewHealth) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this elder\'s health data.' } },
        { status: 403 },
      );
    }
    return {
      userId: user.userId,
      role: 'caregiver',
      elderUserId,
      canManageMeds: relation.canManageMeds,
    };
  }

  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'This feature is not available for your role.' } },
    { status: 403 },
  );
}

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ success: true, data }, { status });

export const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });
