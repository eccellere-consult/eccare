import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { getElderNeighborhoodId } from '@/lib/community-access';

const schema = z.object({
  perKmRate: z.number().positive(),
  perMinWaitRate: z.number().nonnegative(),
  neighborhoodId: z.string().optional(),
});

/** One rate card per community. Read by any member; set by committee/admin. */
export async function GET(req: NextRequest) {
  const elderUserId = req.nextUrl.searchParams.get('elderUserId');
  let neighborhoodId: string;

  if (elderUserId) {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
    }
    const resolved = await getElderNeighborhoodId(auth.userId, elderUserId);
    if (resolved === null) {
      if (!(await canAccessElder(auth.userId, elderUserId))) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this elder.' } }, { status: 403 });
      }
      return ok(null); // elder hasn't joined a community yet
    }
    neighborhoodId = resolved;
  } else {
    const guard = await requireMembership(req);
    if (guard.error) return guard.error;
    neighborhoodId = guard.neighborhoodId;
  }

  const rateCard = await prisma.autoRateCard.findUnique({ where: { neighborhoodId } });
  return ok(rateCard);
}

/** Upsert — there's exactly one rate card per community, so setting it again
 *  just replaces the previous rates rather than needing a separate edit route. */
export async function PUT(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter both rates as positive numbers.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { perKmRate, perMinWaitRate } = parsed.data;

  const rateCard = await prisma.autoRateCard.upsert({
    where: { neighborhoodId: guard.neighborhoodId },
    create: { neighborhoodId: guard.neighborhoodId, perKmRate, perMinWaitRate },
    update: { perKmRate, perMinWaitRate },
  });

  return ok(rateCard);
}
