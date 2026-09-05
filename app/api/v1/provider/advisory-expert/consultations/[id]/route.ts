import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  status: z.enum(['in_progress', 'completed']),
});

/** Self-service status update — the expert moves their own assigned
 *  consultation along, instead of asking the platform team to update it on
 *  their behalf. Deliberately can't set 'submitted' (that's the initial
 *  state only) or reassign to a different expert (still an admin action). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const expert = await prisma.advisoryExpert.findUnique({ where: { providerId: provider.id } });
  if (!expert) return fail('NOT_FOUND', 'Your advisory profile is created once your account is verified.', 404);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);
  if (consultation.assignedExpertId !== expert.id) return fail('FORBIDDEN', "This isn't assigned to you.", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details.', 400);

  const updated = await prisma.consultationRequest.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, data: updated });
}
