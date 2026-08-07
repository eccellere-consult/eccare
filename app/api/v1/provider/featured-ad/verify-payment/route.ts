import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { verifyPaymentSignature } from '@/lib/razorpay';

const schema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Same never-trust-the-client pattern as every other payment route in this app —
 *  re-verifies the Razorpay HMAC signature server-side before marking the provider
 *  featured. No platform-fee split here: this is EC's own ad revenue, not a
 *  pass-through payment to a vendor/association, so nothing gets snapshotted the
 *  way Order/FeeCharge do. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Missing payment details.', 400);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'No provider profile found.', 404);
  if (provider.featuredOrderId !== parsed.data.razorpayOrderId) {
    return fail('MISMATCH', 'This payment does not match your account.', 400);
  }

  const valid = verifyPaymentSignature(
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId,
    parsed.data.razorpaySignature,
  );
  if (!valid) {
    return fail('INVALID_SIGNATURE', 'Payment could not be verified. Please contact support.', 400);
  }

  const now = new Date();
  // Extends from the later of "now" or the current featuredUntil, so paying again
  // before the previous 30 days lapse adds on top rather than resetting the clock.
  const base = provider.featuredUntil && provider.featuredUntil > now ? provider.featuredUntil : now;
  const featuredUntil = new Date(base.getTime() + THIRTY_DAYS_MS);

  const updated = await prisma.serviceProvider.update({
    where: { id: provider.id },
    data: { isFeatured: true, featuredUntil, featuredPaidAt: now },
  });

  return NextResponse.json({ success: true, data: updated });
}
