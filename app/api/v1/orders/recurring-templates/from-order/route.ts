import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ orderId: z.string() });

/** "Set up monthly reorder" from a past order — the quick path (vs. the
 *  generic POST /recurring-templates): defaults unitsPerMonth to what was
 *  actually ordered last time, exactly the "based on the previous order"
 *  ask. One template per item that has a live catalogItemId (a
 *  since-deleted catalog item has nothing to reorder against). */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { items: true, provider: { select: { id: true, category: true } } },
  });
  if (!order) return fail('NOT_FOUND', 'Order not found.', 404);
  if (!(await canAccessElder(auth.userId, order.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this order.", 403);
  }
  if (order.provider.category !== 'pharmacy') {
    return fail('NOT_PHARMACY', 'Monthly reorder is only available for pharmacy orders.', 400);
  }

  const created = [];
  for (const item of order.items) {
    if (!item.catalogItemId) continue;
    const existing = await prisma.recurringOrderTemplate.findFirst({
      where: { elderUserId: order.elderUserId, catalogItemId: item.catalogItemId, isActive: true },
    });
    const template = existing
      ? await prisma.recurringOrderTemplate.update({ where: { id: existing.id }, data: { unitsPerMonth: item.quantity } })
      : await prisma.recurringOrderTemplate.create({
          data: {
            elderUserId: order.elderUserId,
            providerId: order.providerId,
            catalogItemId: item.catalogItemId,
            unitsPerMonth: item.quantity,
          },
        });
    created.push(template);
  }

  if (created.length === 0) {
    return fail('NO_ITEMS', 'This order has no items that can be set up for reorder.', 400);
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
