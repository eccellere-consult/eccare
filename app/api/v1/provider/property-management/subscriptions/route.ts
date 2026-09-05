import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Every elder who's specifically subscribed to the caller's own Property
 *  Management business — the provider sees their own client list and
 *  submits inspections directly, instead of admin assigning an unspecified
 *  field agent (the legacy path this replaces for self-registered
 *  providers). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const subscriptions = await prisma.propertySubscription.findMany({
    where: { providerId: provider.id, status: 'active' },
    include: {
      elderUser: { select: { id: true, name: true, address: true, city: true, phone: true } },
      inspections: { orderBy: { inspectedAt: 'desc' }, take: 1, select: { inspectedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: subscriptions });
}
