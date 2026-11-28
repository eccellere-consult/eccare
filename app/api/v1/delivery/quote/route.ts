import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { quoteOrderDelivery } from '@/lib/delivery-jobs';

const schema = z.object({
  elderUserId: z.string(),
  providerId: z.string(),
  items: z.array(z.object({ catalogItemId: z.string(), quantity: z.number().int().min(1).max(99) })).min(1),
});

/** The delivery charge the checkout will add, so the customer sees it before paying.
 *  The order itself recomputes it on the server; this is only for showing. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Please check the cart.' } }, { status: 400 });
  if (!(await canAccessElder(auth.userId, parsed.data.elderUserId))) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: "You don't have access to order for this elder." } }, { status: 403 });
  }
  return NextResponse.json({ success: true, data: await quoteOrderDelivery(parsed.data) });
}
