import { NextResponse } from 'next/server';
import { getFeatureSwitches } from '@/lib/feature-switches';

export const dynamic = 'force-dynamic';

/** Which launch-day features are On. Public: the sign-up form uses it to show
 *  the home-care staff option only once that feature is open. */
export async function GET() {
  return NextResponse.json({ success: true, data: await getFeatureSwitches() });
}
