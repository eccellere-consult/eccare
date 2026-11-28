import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { BLOOD_GROUPS } from '@/lib/emergency-card';

/** Quick-reference info for an elder: family doctor, preferred hospital and the emergency card. This is
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
  // Emergency card: what a doctor or ambulance crew needs to know at once.
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
  allergies: z.string().max(1000).nullable().optional(),
  medicalConditions: z.string().max(1000).nullable().optional(),
  implantsDevices: z.string().max(500).nullable().optional(),
  emergencyNotes: z.string().max(1000).nullable().optional(),
});

const SELECT = {
  familyDoctorName: true,
  familyDoctorPhone: true,
  familyDoctorVideoLink: true,
  preferredHospitalName: true,
  preferredHospitalLocation: true,
  bloodGroup: true,
  allergies: true,
  medicalConditions: true,
  implantsDevices: true,
  emergencyNotes: true,
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const user = await prisma.user.findUnique({
    where: { id: guard.elderUserId },
    select: SELECT,
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

  const { elderUserId: _omit, ...raw } = parsed.data;
  // Blank boxes are stored as "not set", not as empty text.
  const data = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v]),
  );

  const user = await prisma.user.update({
    where: { id: guard.elderUserId },
    data,
    select: SELECT,
  });

  return ok(user);
}
