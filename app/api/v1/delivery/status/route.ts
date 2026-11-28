import { NextResponse } from 'next/server';
import { isDeliveryEnabled } from '@/lib/delivery-settings';

export const dynamic = 'force-dynamic';

/** Public: is delivery switched on? The sign-up form shows "Delivery partner" only when it is. */
export async function GET() {
  return NextResponse.json({ success: true, data: { enabled: await isDeliveryEnabled() } });
}
