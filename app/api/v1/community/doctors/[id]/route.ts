import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  specialty: z.string().min(1).max(120).optional(),
  clinicName: z.string().max(200).nullable().optional(),
  qualifications: z.string().max(1000).nullable().optional(),
  background: z.string().max(2000).nullable().optional(),
  locality: z.string().max(160).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  mapsLink: z.string().url().nullable().optional(),
  phone: z.string().min(3).max(20).optional(),
  consultationFee: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doctor = await prisma.localDoctor.findUnique({ where: { id } });
  if (!doctor) return fail('NOT_FOUND', 'Doctor not found.', 404);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: doctor.neighborhoodId });
  if (guard.error) return guard.error;

  const updated = await prisma.localDoctor.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doctor = await prisma.localDoctor.findUnique({ where: { id } });
  if (!doctor) return fail('NOT_FOUND', 'Doctor not found.', 404);

  const guard = await requireMembership(req, { manage: true, neighborhoodId: doctor.neighborhoodId });
  if (guard.error) return guard.error;

  await prisma.localDoctor.delete({ where: { id } });
  return ok(null);
}
