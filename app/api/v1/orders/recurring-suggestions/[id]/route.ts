import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ action: z.literal('decline') });

/** Declining never places an order — approving is a separate route (POST
 *  .../approve) since it needs to return Razorpay payment details for the
 *  frontend to open checkout, not just flip a status. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const suggestion = await prisma.recurringOrderSuggestion.findUnique({ where: { id }, include: { template: true } });
  if (!suggestion) return fail('NOT_FOUND', 'Suggestion not found.', 404);
  if (!(await canAccessElder(auth.userId, suggestion.template.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this reorder.", 403);
  }
  if (suggestion.status !== 'pendingApproval') {
    return fail('INVALID_STATE', 'This suggestion has already been decided.', 409);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Invalid request.', 400);

  const updated = await prisma.recurringOrderSuggestion.update({ where: { id }, data: { status: 'declined' } });
  return NextResponse.json({ success: true, data: updated });
}
