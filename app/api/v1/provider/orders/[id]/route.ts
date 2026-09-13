import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({ status: z.enum(['confirmed', 'delivered', 'cancelled']) });

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

// Only these two (status, current-status) pairs are legal — everything else
// (skipping a step, moving backward, acting on an already-closed/cancelled
// order) is rejected. `cancelled` is only reachable from `paid`, matching the
// existing "nothing to cancel before payment went through" rule unchanged.
const ALLOWED_TRANSITIONS: Record<string, 'paid' | 'confirmed'> = {
  confirmed: 'paid',
  cancelled: 'paid',
  delivered: 'confirmed',
};

/** Provider moves a `paid` order to `confirmed` (accepted/fulfilling) or
 *  `cancelled`, or a `confirmed` order to `delivered` (physical handoff
 *  done) — `closed` is customer-only, see POST /api/v1/orders/[id]/close. */
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

  const requiredCurrentStatus = ALLOWED_TRANSITIONS[parsed.data.status];
  if (order.status !== requiredCurrentStatus) {
    return fail('INVALID_STATE', `Only a ${requiredCurrentStatus} order can be moved to ${parsed.data.status}.`, 409);
  }

  const updated = await prisma.order.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, data: updated });
}
