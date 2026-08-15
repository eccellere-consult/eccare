import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

/** Quick-reference info for an elder: family doctor and preferred hospital. This is
 *  reference info, not medication management, so it uses the same permission tier
 *  as HealthNote — any caregiver with canViewHealth can read and edit it, not just
 *  ones with canManageMeds. */
const patchSchema = z.object({
  elderUserId: z.string().optional(),
  familyDoctorName: z.string().max(160).nullable().optional(),
  familyDoctorPhone: z.string().max(20).nullable().optional(),
  // Google Meet or similar meeting link — alongside the tel: dial-out
  // (familyDoctorPhone) and a WhatsApp chat built from that same phone number.
  familyDoctorVideoLink: z.string().max(500).nullable().optional(),
  preferredHospitalName: z.string().max(160).nullable().optional(),
  preferredHospitalLocation: z.string().max(300).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const user = await prisma.user.findUnique({
    where: { id: guard.elderUserId },
    select: {
      familyDoctorName: true,
      familyDoctorPhone: true,
      familyDoctorVideoLink: true,
      preferredHospitalName: true,
      preferredHospitalLocation: true,
    },
  });
  if (!user) return fail('NOT_FOUND', 'Elder not found.', 404);

  return ok(user);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { elderUserId: _omit, ...data } = parsed.data;

  const user = await prisma.user.update({
    where: { id: guard.elderUserId },
    data,
    select: {
      familyDoctorName: true,
      familyDoctorPhone: true,
      familyDoctorVideoLink: true,
      preferredHospitalName: true,
      preferredHospitalLocation: true,
    },
  });

  return ok(user);
}
