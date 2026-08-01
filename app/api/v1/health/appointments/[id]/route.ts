import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const updateSchema = z.object({
  doctorName: z.string().min(1).max(200).optional(),
  hospital: z.string().max(200).nullable().optional(),
  specialty: z.string().max(100).nullable().optional(),
  datetime: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { userId: true } });
  if (!appt) return fail('NOT_FOUND', 'Appointment not found.', 404);

  const guard = await requireHealthAccess(req, appt.userId);
  if (guard instanceof Response) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.datetime) data.datetime = new Date(data.datetime as string);

  const updated = await prisma.appointment.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { userId: true } });
  if (!appt) return fail('NOT_FOUND', 'Appointment not found.', 404);

  const guard = await requireHealthAccess(req, appt.userId);
  if (guard instanceof Response) return guard;

  await prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } });
  return ok({ cancelled: true });
}
