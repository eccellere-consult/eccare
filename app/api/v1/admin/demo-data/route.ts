import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';
import { getDemoStatus, loadDemoData, removeDemoData } from '@/lib/demo';
import { setDemoUnlock } from '@/lib/demo/lock';
import { setDemoAutoState } from '@/lib/demo/auto';

// Loading writes a few thousand rows in one go; give it room on slower hosts.
export const maxDuration = 120;

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

const failure = (err: unknown) =>
  NextResponse.json(
    { success: false, error: { code: 'DEMO_FAILED', message: err instanceof Error ? err.message : 'Something went wrong while preparing the demo.' } },
    { status: 500 },
  );

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  return NextResponse.json({ success: true, data: await getDemoStatus() });
}

/** Loads the demo, or refreshes it if it is already loaded. */
export async function POST(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;
  try {
    return NextResponse.json({ success: true, data: await loadDemoData(auth!.userId) });
  } catch (err) {
    return failure(err);
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  try {
    await removeDemoData();
    // Removed on purpose: never bring it back by itself.
    await setDemoAutoState('off');
    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (err) {
    return failure(err);
  }
}

const unlockSchema = z.object({
  /** Minutes to allow editing for; null or 0 locks it again immediately. */
  unlockMinutes: z.number().int().min(0).max(7 * 24 * 60).nullable(),
});

/** Unlocks editing of the demo data for a while, or locks it again. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  const parsed = unlockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Choose how long to unlock for.' } }, { status: 400 });
  }
  try {
    await setDemoUnlock(parsed.data.unlockMinutes || null);
    return NextResponse.json({ success: true, data: await getDemoStatus() });
  } catch (err) {
    return failure(err);
  }
}
