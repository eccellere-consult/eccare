import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({
    where: { id },
    include: { assignedExpert: true, documents: true },
  });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);

  if (auth.role !== 'admin' && !(await canAccessElder(auth.userId, consultation.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this consultation.", 403);
  }

  return NextResponse.json({ success: true, data: consultation });
}

const adminUpdateSchema = z.object({
  status: z.enum(['submitted', 'in_progress', 'completed']).optional(),
  assignedExpertId: z.string().nullable().optional(),
});

/** Admin only — assigning an expert and updating status is how the platform
 *  team coordinates a real consultation, since experts have no login of their
 *  own to do this themselves. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { id } = await params;
  const parsed = adminUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details.', 400);

  const updated = await prisma.consultationRequest.update({
    where: { id },
    data: parsed.data,
    include: { assignedExpert: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
