import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { FEATURE_KEYS, getFeatureSwitches, setFeature } from '@/lib/feature-switches';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ key: z.enum(FEATURE_KEYS), enabled: z.boolean() });

/** Admin turns a launch-day feature On or Off. */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Unknown switch.', 400);

  await setFeature(parsed.data.key, parsed.data.enabled, auth.userId);
  return NextResponse.json({ success: true, data: await getFeatureSwitches() });
}
