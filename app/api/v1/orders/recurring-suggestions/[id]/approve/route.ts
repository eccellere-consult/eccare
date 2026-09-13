import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { createRazorpayOrder } from '@/lib/razorpay';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Approving is the "order is placed once okayed by the elder or caregiver"
 *  step — mirrors POST /api/v1/orders' single-item path (price recomputed
 *  from the live CatalogItem, never trusted from the suggestion), creating a
 *  `pending` Order + Razorpay order and linking it back via
 *  RecurringOrderSuggestion.orderId. The frontend opens the same Razorpay
 *  checkout as a manual order and then calls the EXISTING
 *  POST /api/v1/orders/[id]/verify-payment — no new verify route needed,
 *  since that one already works generically for any Order regardless of how
 *  it was created. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const suggestion = await prisma.recurringOrderSuggestion.findUnique({
    where: { id },
    include: { template: { include: { catalogItem: true } } },
  });
  if (!suggestion) return fail('NOT_FOUND', 'Suggestion not found.', 404);
  const { template } = suggestion;
  if (!(await canAccessElder(auth.userId, template.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this reorder.", 403);
  }
  if (suggestion.status !== 'pendingApproval') {
    return fail('INVALID_STATE', 'This suggestion has already been decided.', 409);
  }
  if (!template.catalogItem.inStock) {
    return fail('OUT_OF_STOCK', 'This item is currently out of stock.', 409);
  }

  const elder = await prisma.user.findUnique({ where: { id: template.elderUserId }, select: { address: true, city: true, state: true, pincode: true } });
  const deliveryAddress = [elder?.address, elder?.city, elder?.state, elder?.pincode].filter(Boolean).join(', ') || 'Address on file';

  const totalAmount = Number(template.catalogItem.price) * template.unitsPerMonth;

  const order = await prisma.order.create({
    data: {
      elderUserId: template.elderUserId,
      placedByUserId: auth.userId,
      providerId: template.providerId,
      paymentMethod: 'razorpay',
      totalAmount,
      deliveryAddress,
      items: {
        create: [{ catalogItemId: template.catalogItemId, name: template.catalogItem.name, price: template.catalogItem.price, quantity: template.unitsPerMonth }],
      },
    },
  });

  try {
    const razorpayOrder = await createRazorpayOrder(totalAmount, order.id);
    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: razorpayOrder.id } });
    await prisma.recurringOrderSuggestion.update({ where: { id }, data: { status: 'approved', orderId: order.id } });

    return NextResponse.json(
      {
        success: true,
        data: { orderId: order.id, razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, keyId: process.env.RAZORPAY_KEY_ID },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Razorpay order creation failed for recurring order approval:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
