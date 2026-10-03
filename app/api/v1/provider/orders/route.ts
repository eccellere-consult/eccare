import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { houseKey } from '@/lib/house';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A provider's own incoming orders. Only paid/confirmed orders are shown by
 *  default — a `pending` (payment not yet completed) order isn't a real
 *  commitment yet. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const orders = await prisma.order.findMany({
    where: { providerId: provider.id, status: { in: ['paid', 'confirmed', 'delivered', 'closed', 'cancelled'] } },
    include: { items: true, elderUser: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Where the elder's house is, if a resident or the committee has pinned it — so the
  // provider can navigate there. Shared only with the provider fulfilling this order.
  const elderIds = [...new Set(orders.map((o) => o.elderUser.id))];
  const memberships = elderIds.length
    ? await prisma.neighborhoodMember.findMany({
        where: { userId: { in: elderIds }, status: 'approved', flatNumber: { not: null } },
        select: { userId: true, neighborhoodId: true, flatNumber: true },
      })
    : [];
  const locations = memberships.length
    ? await prisma.houseLocation.findMany({
        where: { neighborhoodId: { in: [...new Set(memberships.map((m) => m.neighborhoodId))] } },
      })
    : [];
  const locationOfElder = (elderId: string) => {
    for (const m of memberships.filter((x) => x.userId === elderId)) {
      const key = houseKey(m.flatNumber);
      const row = locations.find((l) => l.neighborhoodId === m.neighborhoodId && l.houseKey === key);
      if (row) return { lat: Number(row.lat), lng: Number(row.lng) };
    }
    return null;
  };

  return NextResponse.json({
    success: true,
    data: orders.map((o) => ({ ...o, elderUser: { ...o.elderUser, location: locationOfElder(o.elderUser.id) } })),
  });
}
