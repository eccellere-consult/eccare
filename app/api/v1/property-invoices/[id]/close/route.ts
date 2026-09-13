import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRating } from '@/lib/ratings';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });
const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });

const schema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

/** Customer-side closure: confirms the repair job is done and rates the
 *  provider, once the invoice has been paid. The invoice IS the
 *  delivered-service record for this inspection cycle — no separate
 *  "delivered" state needed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please give a star rating between 1 and 5.', 400);

  const invoice = await prisma.propertyInvoice.findUnique({
    where: { id },
    include: {
      repairEstimate: {
        include: { inspection: { include: { subscription: { select: { elderUserId: true, providerId: true } } } } },
      },
    },
  });
  if (!invoice) return fail('NOT_FOUND', 'Invoice not found.', 404);

  const { elderUserId, providerId } = invoice.repairEstimate.inspection.subscription;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this invoice.", 403);
  }
  if (invoice.status !== 'paid') {
    return fail('INVALID_STATE', 'This invoice can only be closed once it has been paid.', 409);
  }

  const updated = await prisma.propertyInvoice.update({ where: { id }, data: { status: 'closed' } });
  await createRating({
    providerId,
    raterUserId: auth.userId,
    stars: parsed.data.stars,
    comment: parsed.data.comment,
    context: { propertyInvoiceId: id },
  });

  return ok(updated);
}
