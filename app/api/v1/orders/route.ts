import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const schema = z.object({
  elderUserId: z.string(),
  providerId: z.string(),
  items: z
    .array(z.object({ catalogItemId: z.string(), quantity: z.number().int().min(1).max(99) }))
    .min(1),
  deliveryAddress: z.string().min(1).max(2000),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's orders.", 403);
  }

  const orders = await prisma.order.findMany({
    where: { elderUserId },
    include: { items: true, provider: { select: { businessName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: orders });
}

/** Creates an order and a matching Razorpay order. The client's displayed price is
 *  never trusted — the total is recomputed here from real CatalogItem.price rows. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please check your order and try again.', 400);

  const { elderUserId, providerId, items, deliveryAddress } = parsed.data;

  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to order for this elder.", 403);
  }

  const catalogItems = await prisma.catalogItem.findMany({
    where: { id: { in: items.map((i) => i.catalogItemId) }, providerId, inStock: true },
  });
  if (catalogItems.length !== items.length) {
    return fail('INVALID_ITEMS', 'One or more items are no longer available. Please refresh and try again.', 409);
  }

  const priceById = new Map(catalogItems.map((c) => [c.id, c]));
  let totalAmount = 0;
  const orderItemsData = items.map((i) => {
    const catalogItem = priceById.get(i.catalogItemId)!;
    const price = Number(catalogItem.price);
    totalAmount += price * i.quantity;
    return { catalogItemId: catalogItem.id, name: catalogItem.name, price: catalogItem.price, quantity: i.quantity };
  });

  const order = await prisma.order.create({
    data: {
      elderUserId,
      placedByUserId: auth.userId,
      providerId,
      totalAmount,
      deliveryAddress,
      items: { create: orderItemsData },
    },
  });

  try {
    const razorpayOrder = await createRazorpayOrder(totalAmount, order.id);
    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: razorpayOrder.id } });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Razorpay order creation failed:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
