import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const schema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });
const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** The elder or their family rates the delivery partner once the order has been delivered.
 *  Separate from the shop's rating, so a late rider never drags down a good shop or the other way round. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please choose 1 to 5 stars.', 400);

  const job = await prisma.deliveryJob.findUnique({ where: { orderId: id }, include: { order: { select: { elderUserId: true } } } });
  if (!job) return fail('NOT_FOUND', 'This order had no EC delivery.', 404);
  if (!(await canAccessElder(auth.userId, job.order.elderUserId))) return fail('FORBIDDEN', "You don't have access to this order.", 403);
  if (job.status !== 'delivered') return fail('INVALID_STATE', 'You can rate the delivery once it has arrived.', 409);
  if (job.rating !== null) return fail('ALREADY_RATED', 'This delivery has already been rated.', 409);

  const updated = await prisma.deliveryJob.update({
    where: { id: job.id },
    data: { rating: parsed.data.stars, ratingComment: parsed.data.comment || null, ratedAt: new Date() },
    select: { rating: true, ratingComment: true },
  });
  return NextResponse.json({ success: true, data: updated });
}
