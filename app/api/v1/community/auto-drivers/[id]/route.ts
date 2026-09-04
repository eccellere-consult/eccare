import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(3).max(20).optional(),
  vehicleNumber: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await prisma.autoDriver.findUnique({ where: { id } });
  if (!driver) return fail('NOT_FOUND', 'Driver not found.', 404);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: driver.neighborhoodId });
  if (guard.error) return guard.error;

  const updated = await prisma.autoDriver.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await prisma.autoDriver.findUnique({ where: { id } });
  if (!driver) return fail('NOT_FOUND', 'Driver not found.', 404);

  const guard = await requireMembership(req, { manage: true, neighborhoodId: driver.neighborhoodId });
  if (guard.error) return guard.error;

  await prisma.autoDriver.delete({ where: { id } });
  return ok(null);
}
