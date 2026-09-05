import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Every LocalDoctor row linked to the caller's own ServiceProvider account —
 *  one per community they've been approved to join (see
 *  admin/provider-requests/[id] for how a row gets created and linked). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const doctors = await prisma.localDoctor.findMany({
    where: { providerId: provider.id },
    include: {
      neighborhood: { select: { id: true, name: true } },
      slots: { where: { isBooked: false, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: doctors });
}
