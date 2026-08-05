import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({ status: z.enum(['confirmed', 'cancelled']) });

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Provider marks an order confirmed (fulfilling it) or cancelled. Only valid on a
 *  `paid` order — nothing to confirm/cancel before payment actually went through. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please check the details and try again.', 400);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return fail('NOT_FOUND', 'Order not found.', 404);
  if (order.providerId !== provider.id) return fail('FORBIDDEN', "You don't have access to this order.", 403);
  if (order.status !== 'paid') {
    return fail('INVALID_STATE', 'Only a paid order can be confirmed or cancelled.', 409);
  }

  const updated = await prisma.order.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, data: updated });
}
