import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRating } from '@/lib/ratings';

const schema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Customer-side closure: confirms the order was received and rates the
 *  provider, once the provider has marked it `delivered`. Whoever placed it
 *  OR the elder it's for can close it — same access shape as every other
 *  elder-scoped action in this app (canAccessElder).
 *
 *  Status update and rating creation are two sequential awaits rather than
 *  a $transaction: if the rating write somehow failed after the order is
 *  already `closed`, there's no inconsistent state a retry (or an admin
 *  backfill) couldn't fix — a customer just can't close the same order
 *  twice either way, since the second attempt would 409 on status. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please give a star rating between 1 and 5.', 400);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return fail('NOT_FOUND', 'Order not found.', 404);
  if (!(await canAccessElder(auth.userId, order.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this order.", 403);
  }
  if (order.status !== 'delivered') {
    return fail('INVALID_STATE', 'This order can only be closed once it has been delivered.', 409);
  }

  const updated = await prisma.order.update({ where: { id }, data: { status: 'closed' } });
  await createRating({
    providerId: order.providerId,
    raterUserId: auth.userId,
    stars: parsed.data.stars,
    comment: parsed.data.comment,
    context: { orderId: id },
  });

  return NextResponse.json({ success: true, data: updated });
}
