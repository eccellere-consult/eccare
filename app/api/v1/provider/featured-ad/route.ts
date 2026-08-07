import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createRazorpayOrder } from '@/lib/razorpay';
import { getElderCareAdPrice } from '@/lib/platform-settings';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Creates a Razorpay order for the current month's featured-ad price. A provider
 *  must be verified and have picked an elder-care category first — buying a
 *  featured slot before the profile is even eligible to appear would be pointless. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'No provider profile found.', 404);
  if (provider.verificationStatus !== 'verified') {
    return fail('NOT_VERIFIED', 'Your account must be verified before you can advertise.', 400);
  }
  if (!provider.elderCareCategory) {
    return fail('NO_CATEGORY', 'Pick an elder-care category on your profile first.', 400);
  }

  try {
    const price = await getElderCareAdPrice();
    const razorpayOrder = await createRazorpayOrder(price, `featured-ad-${provider.id}-${Date.now()}`);
    await prisma.serviceProvider.update({ where: { id: provider.id }, data: { featuredOrderId: razorpayOrder.id } });

    return NextResponse.json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error('Razorpay order creation failed for featured ad:', err instanceof Error ? err.message : err);
    return fail('PAYMENT_SETUP_FAILED', 'Could not start payment. Please try again.', 502);
  }
}
