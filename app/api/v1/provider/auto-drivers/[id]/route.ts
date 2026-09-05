import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(3).max(20).optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  vehicleNumber: z.string().max(20).nullable().optional(),
  serviceArea: z.string().max(160).nullable().optional(),
  perKmRate: z.number().positive().nullable().optional(),
  perMinWaitRate: z.number().nonnegative().nullable().optional(),
  isAvailable: z.boolean().optional(),
});

/** Self-service update — a provider editing their own rates/WhatsApp/
 *  availability/etc, not admin/committee. Deliberately excludes
 *  neighborhoodId (which community this row belongs to) and providerId
 *  (the link itself) — both stay controlled by the join-a-community +
 *  admin-approval flow, not editable after the fact by the provider. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const { id } = await params;
  const driver = await prisma.autoDriver.findUnique({ where: { id } });
  if (!driver) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (driver.providerId !== provider.id) return fail('FORBIDDEN', "This isn't your listing.", 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const updated = await prisma.autoDriver.update({
    where: { id },
    data: parsed.data,
    include: { neighborhood: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}
