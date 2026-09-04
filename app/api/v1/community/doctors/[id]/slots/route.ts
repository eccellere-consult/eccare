import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ startsAt: z.string().datetime() });

/** Admin/committee adds one bookable slot at a time — a plain date+time they got
 *  from calling the clinic, not a recurring schedule or live calendar sync. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doctor = await prisma.localDoctor.findUnique({ where: { id } });
  if (!doctor) return fail('NOT_FOUND', 'Doctor not found.', 404);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please pick a valid date and time.');

  const guard = await requireMembership(req, { manage: true, neighborhoodId: doctor.neighborhoodId });
  if (guard.error) return guard.error;

  const slot = await prisma.doctorSlot.create({
    data: { doctorId: id, startsAt: new Date(parsed.data.startsAt) },
  });

  return ok(slot, 201);
}
