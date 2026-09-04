import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  const { id, slotId } = await params;
  const doctor = await prisma.localDoctor.findUnique({ where: { id } });
  if (!doctor) return fail('NOT_FOUND', 'Doctor not found.', 404);

  const guard = await requireMembership(req, { manage: true, neighborhoodId: doctor.neighborhoodId });
  if (guard.error) return guard.error;

  const slot = await prisma.doctorSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.doctorId !== id) return fail('NOT_FOUND', 'Slot not found.', 404);
  if (slot.isBooked) return fail('SLOT_BOOKED', 'This slot is already booked and cannot be removed.', 400);

  await prisma.doctorSlot.delete({ where: { id: slotId } });
  return ok(null);
}
