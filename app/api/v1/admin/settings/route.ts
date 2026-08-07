import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import {
  getPlatformFeePercent,
  setPlatformFeePercent,
  getElderCareAdPrice,
  setElderCareAdPrice,
} from '@/lib/platform-settings';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const [platformFeePercent, elderCareAdPricePerMonth] = await Promise.all([
    getPlatformFeePercent(),
    getElderCareAdPrice(),
  ]);
  return NextResponse.json({ success: true, data: { platformFeePercent, elderCareAdPricePerMonth } });
}

const patchSchema = z.object({
  // 0–100 with up to 2 decimal places — matches the Decimal(5,2) column. Upper
  // bound is a sanity guard, not a real business constraint that needed a
  // conversation — nobody is charging a 100%+ commission by accident.
  platformFeePercent: z.number().min(0).max(100).optional(),
  elderCareAdPricePerMonth: z.number().min(0).optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success || (parsed.data.platformFeePercent === undefined && parsed.data.elderCareAdPricePerMonth === undefined)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter a valid value.' } },
      { status: 400 },
    );
  }

  const [platformFeePercent, elderCareAdPricePerMonth] = await Promise.all([
    parsed.data.platformFeePercent !== undefined
      ? setPlatformFeePercent(parsed.data.platformFeePercent, auth!.userId)
      : getPlatformFeePercent(),
    parsed.data.elderCareAdPricePerMonth !== undefined
      ? setElderCareAdPrice(parsed.data.elderCareAdPricePerMonth, auth!.userId)
      : getElderCareAdPrice(),
  ]);
  return NextResponse.json({ success: true, data: { platformFeePercent, elderCareAdPricePerMonth } });
}
