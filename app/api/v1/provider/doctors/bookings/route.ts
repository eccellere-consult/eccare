import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Every booking across all of the caller's own LocalDoctor listings — the
 *  doctor sees who's coming directly, instead of the booker having to phone
 *  the clinic and self-report confirmation (the legacy no-login path this
 *  replaces for self-registered doctors). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const bookings = await prisma.doctorBooking.findMany({
    where: { doctor: { providerId: provider.id } },
    include: {
      doctor: { select: { name: true, neighborhood: { select: { name: true } } } },
      slot: true,
      elderUser: { select: { name: true, phone: true } },
    },
    orderBy: { slot: { startsAt: 'asc' } },
  });

  return NextResponse.json({ success: true, data: bookings });
}
