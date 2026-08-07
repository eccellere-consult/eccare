import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const patchSchema = z.object({
  businessName: z.string().min(1).max(160).optional(),
  category: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  serviceArea: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  elderCareCategory: z
    .enum(['home_treatment', 'home_nursing', 'companion_service', 'local_errands', 'other'])
    .nullable()
    .optional(),
});

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

async function requireProvider(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: fail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'provider') return { error: fail('FORBIDDEN', 'Providers only.', 403) };
  return { auth };
}

/** The caller's own service-provider profile. */
export async function GET(req: NextRequest) {
  const { auth, error } = await requireProvider(req);
  if (error) return error;

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'No provider profile found.', 404);

  return NextResponse.json({ success: true, data: provider });
}

/** Providers can edit their own business details at any time — this doesn't reset
 *  verificationStatus, since a business-detail tweak isn't the same trust event as
 *  a fresh, unverified signup; admins can always re-review if something looks off. */
export async function PATCH(req: NextRequest) {
  const { auth, error } = await requireProvider(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return fail('INVALID_INPUT', 'Please check the details and try again.');
  }

  const provider = await prisma.serviceProvider.update({
    where: { userId: auth.userId },
    data: parsed.data,
  });

  return NextResponse.json({ success: true, data: provider });
}
