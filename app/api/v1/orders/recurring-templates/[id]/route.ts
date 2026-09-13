import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ unitsPerMonth: z.number().int().min(1).max(999).optional(), isActive: z.boolean().optional() });

/** Adjust the planned monthly quantity, or pause/resume suggestions for this
 *  item (isActive: false stops new RecurringOrderSuggestions from being
 *  generated — it doesn't touch any order already placed). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const template = await prisma.recurringOrderTemplate.findUnique({ where: { id } });
  if (!template) return fail('NOT_FOUND', 'Reorder template not found.', 404);
  if (!(await canAccessElder(auth.userId, template.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this reorder.", 403);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const updated = await prisma.recurringOrderTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: updated });
}
