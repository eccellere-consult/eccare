import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { createDirectoryProvider } from '@/lib/provider-directory';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { getElderNeighborhoodId } from '@/lib/community-access';

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(3).max(20),
  whatsapp: z.string().max(20).optional(),
  vehicleNumber: z.string().max(20).optional(),
  serviceArea: z.string().max(160).optional(),
  perKmRate: z.number().positive().optional(),
  perMinWaitRate: z.number().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  neighborhoodId: z.string().optional(),
});

/** Auto-rickshaw drivers vetted for the community. Read by any member; booking
 *  is a WhatsApp handoff from the client, not a route here — the driver
 *  confirms availability directly over WhatsApp, no in-app dispatch. */
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
      return ok([]); // elder hasn't joined a community yet
    }
    neighborhoodId = resolved;
  } else {
    const guard = await requireMembership(req);
    if (guard.error) return guard.error;
    neighborhoodId = guard.neighborhoodId;
  }

  const drivers = await prisma.autoDriver.findMany({
    where: { neighborhoodId },
    include: { provider: { select: { verificationStatus: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(drivers);
}

/** Committee/admin only — same reasoning as helplines/doctors: a wrong number
 *  here sends an elder's ride request to a stranger. Also creates a linked
 *  placeholder ServiceProvider (see lib/provider-directory) purely to reuse
 *  the existing verification/admin-approval machinery. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name and phone number.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { neighborhoodId: _omit, ...data } = parsed.data;

  const driver = await prisma.$transaction(async (tx) => {
    const provider = await createDirectoryProvider(tx, {
      name: data.name,
      category: 'auto_transport',
      serviceArea: data.serviceArea,
      phone: data.phone,
    });
    return tx.autoDriver.create({
      data: { ...data, neighborhoodId: guard.neighborhoodId, providerId: provider.id, sortOrder: data.sortOrder ?? 0 },
      include: { provider: { select: { verificationStatus: true } } },
    });
  });

  return ok(driver, 201);
}
