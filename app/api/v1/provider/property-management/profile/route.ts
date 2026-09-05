import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  monthlyFee: z.number().nonnegative().nullable().optional(),
  quarterlyFee: z.number().nonnegative().nullable().optional(),
  biannualFee: z.number().nonnegative().nullable().optional(),
});

/** The caller's own rate profile — created blank when their ServiceProvider
 *  account is verified (see admin/providers/[id]). Elders pay this rate when
 *  they specifically pick this provider; the platform's flat
 *  PROPERTY_REVIEW_RATES table is only a fallback for whichever frequency a
 *  provider hasn't set their own rate for. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const profile = await prisma.propertyManagementProfile.findUnique({ where: { providerId: provider.id } });
  return NextResponse.json({ success: true, data: profile });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const profile = await prisma.propertyManagementProfile.findUnique({ where: { providerId: provider.id } });
  if (!profile) return fail('NOT_FOUND', 'Your rate profile is created once your account is verified.', 404);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please enter valid rates.', 400);

  const updated = await prisma.propertyManagementProfile.update({ where: { id: profile.id }, data: parsed.data });
  return NextResponse.json({ success: true, data: updated });
}
