import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { requireOwnDoctor } from '@/lib/provider-doctor-access';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id, slotId } = await params;
  const guard = await requireOwnDoctor(auth, id);
  if (guard.error) return guard.error;

  const slot = await prisma.doctorSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.doctorId !== id) return fail('NOT_FOUND', 'Slot not found.', 404);
  if (slot.isBooked) return fail('SLOT_BOOKED', 'This slot is already booked and cannot be removed.', 400);

  await prisma.doctorSlot.delete({ where: { id: slotId } });
  return NextResponse.json({ success: true, data: null });
}
