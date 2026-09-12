import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getPricingContent, setPricingContent } from '@/lib/pricing-content';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const content = await getPricingContent();
  return NextResponse.json({ success: true, data: content });
}

const patchSchema = z.object({
  isVisible: z.boolean().optional(),
  elderIntro: z.string().max(2000).optional(),
  elderFeatures: z.array(z.string().max(300)).max(30).optional(),
  familyIntro: z.string().max(2000).optional(),
  familyFeatures: z.array(z.string().max(300)).max(30).optional(),
  communityIntro: z.string().max(2000).optional(),
  communityFeatures: z.array(z.string().max(300)).max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please check the details and try again.' } },
      { status: 400 },
    );
  }

  const content = await setPricingContent(parsed.data, auth!.userId);
  return NextResponse.json({ success: true, data: content });
}
