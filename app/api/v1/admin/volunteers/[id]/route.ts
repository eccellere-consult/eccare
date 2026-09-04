import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const patchSchema = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'rejected']),
});

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

/** Approve or reject a volunteer registration — only 'verified' volunteers are
 *  ever shown in the community directory (see GET /community/volunteers). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Please select a valid status.' } }, { status: 400 });
  }

  const volunteer = await prisma.volunteerProfile.findUnique({ where: { id } });
  if (!volunteer) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Volunteer not found.' } }, { status: 404 });
  }

  const updated = await prisma.volunteerProfile.update({
    where: { id },
    data: { verificationStatus: parsed.data.verificationStatus },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}
