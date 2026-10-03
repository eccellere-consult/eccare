import { z } from 'zod';
import { checkDateOfBirth, DOB_ERROR_MESSAGES } from '@/lib/age';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/** Platform-admin-only, and deliberately hard to reach by accident — a User
 *  delete cascades to everything (medications, health records, family
 *  relations, SOS history, memories, orders, community posts...). Built
 *  specifically for the resident bulk-import flow's "duplicate — delete the
 *  stale existing account to make room for the fresh import" case, not as a
 *  general-purpose user management tool. Requires the caller to send back the
 *  exact name on file as confirmation (?confirmName=), so a client-side typo
 *  can't silently delete the wrong account. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only platform admins can do this.' } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } },
      { status: 404 },
    );
  }

  const confirmName = req.nextUrl.searchParams.get('confirmName') || '';
  if (confirmName.trim() !== user.name) {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIRMATION_MISMATCH', message: "The typed name didn't match — nothing was deleted." } },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}

const patchSchema = z.object({
  // Lets a 60+ person use caregiver features (e.g. a 63-year-old son looking after
  // his 88-year-old mother) — the age rule is otherwise a hard check.
  caregiverException: z.boolean().optional(),
  // Admin correction of a date of birth ("YYYY-MM-DD"). Residents can't change
  // their own once it's set, so a wrong one is fixed here.
  dateOfBirth: z.string().optional(),
});

/** Platform-admin-only: grant/revoke the caregiver age exception, or correct a
 *  date of birth. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only platform admins can do this.' } },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (parsed.data.caregiverException === undefined && parsed.data.dateOfBirth === undefined)) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Nothing to update.' } }, { status: 400 });
  }

  let dob: Date | undefined;
  if (parsed.data.dateOfBirth !== undefined) {
    const check = checkDateOfBirth(parsed.data.dateOfBirth);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: DOB_ERROR_MESSAGES[check.reason] } },
        { status: 400 },
      );
    }
    dob = check.dob;
  }

  const { id } = await params;
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.caregiverException !== undefined ? { caregiverException: parsed.data.caregiverException } : {}),
      ...(dob ? { dateOfBirth: dob } : {}),
    },
    select: { id: true, dateOfBirth: true, caregiverException: true },
  });
  return NextResponse.json({ success: true, data: user });
}
