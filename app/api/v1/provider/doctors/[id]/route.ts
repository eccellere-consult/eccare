import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { requireOwnDoctor } from '@/lib/provider-doctor-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  clinicName: z.string().max(200).nullable().optional(),
  specialty: z.string().min(1).max(120).optional(),
  qualifications: z.string().max(1000).nullable().optional(),
  background: z.string().max(2000).nullable().optional(),
  locality: z.string().max(160).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  mapsLink: z.string().url().nullable().optional(),
  phone: z.string().min(3).max(20).optional(),
  consultationFee: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

/** Self-service update — a doctor editing their own profile, not
 *  admin/committee. Excludes neighborhoodId/providerId (community
 *  assignment stays controlled by the join+approval flow) and photoPath
 *  (its own dedicated upload route). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const guard = await requireOwnDoctor(auth, id);
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const updated = await prisma.localDoctor.update({
    where: { id },
    data: parsed.data,
    include: { neighborhood: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}
