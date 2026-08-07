import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Public-to-any-logged-in-user directory of verified elder-care service providers
 *  (home treatment, home nursing, companion service, local errands). Featured
 *  (paid, currently active) providers sort first — see ServiceProvider.isFeatured. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const category = req.nextUrl.searchParams.get('category');
  const now = new Date();

  const providers = await prisma.serviceProvider.findMany({
    where: {
      verificationStatus: 'verified',
      elderCareCategory: { not: null },
      ...(category ? { elderCareCategory: category as never } : {}),
    },
    select: {
      id: true,
      businessName: true,
      elderCareCategory: true,
      description: true,
      serviceArea: true,
      phone: true,
      address: true,
      isFeatured: true,
      featuredUntil: true,
    },
    orderBy: [{ businessName: 'asc' }],
  });

  // isFeatured is set at payment time but not auto-cleared when featuredUntil
  // lapses (no cron in this app — see Reminder's own comment on the same
  // constraint) — so "actually still featured" is computed here at read time
  // rather than trusted from the stored flag alone.
  const withLiveFeatured = providers.map((p) => ({
    ...p,
    isFeatured: p.isFeatured && !!p.featuredUntil && p.featuredUntil > now,
  }));
  withLiveFeatured.sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));

  return NextResponse.json({ success: true, data: withLiveFeatured });
}
