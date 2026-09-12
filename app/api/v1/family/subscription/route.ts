import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getFamilySubscriptionState, resolveFamilyPrice } from '@/lib/family-subscription';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** The caller's own family-subscription state — used by the family layout's
 *  hard-block gate and by the login redirect. Caregivers only; an elder has
 *  no such thing (always free, never blocked). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'caregiver') return fail('FORBIDDEN', 'Family members only.', 403);

  const state = await getFamilySubscriptionState(auth.userId);
  const [monthlyPrice, annualPrice] = await Promise.all([resolveFamilyPrice('monthly'), resolveFamilyPrice('annual')]);

  return NextResponse.json({ success: true, data: { ...state, monthlyPrice, annualPrice } });
}
