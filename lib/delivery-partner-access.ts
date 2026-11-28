import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { DELIVERY_CATEGORY } from '@/lib/delivery-pricing';

export const deliveryFail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A signed-in delivery partner and their delivery profile (created on first save of details). */
export async function requirePartner(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: deliveryFail('UNAUTHORIZED', 'Please log in.', 401) };
  if (auth.role !== 'provider') return { error: deliveryFail('FORBIDDEN', 'Providers only.', 403) };
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId: auth.userId },
    select: { id: true, category: true, verificationStatus: true, deliveryProfile: { select: { id: true } } },
  });
  if (!provider || provider.category !== DELIVERY_CATEGORY.value) {
    return { error: deliveryFail('NOT_DELIVERY', 'This is for delivery partner accounts.', 403) };
  }
  if (!provider.deliveryProfile) {
    return { error: deliveryFail('NO_PROFILE', 'Save your delivery details and free time first.', 409) };
  }
  return { auth, provider, partnerId: provider.deliveryProfile.id };
}
