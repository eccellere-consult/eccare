import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { requireOwnDoctor } from '@/lib/provider-doctor-access';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ startsAt: z.string().datetime() });

/** Self-service — the doctor manages their own bookable time slots directly,
 *  instead of admin/committee entering them on the doctor's behalf (the
 *  legacy no-login path this replaces for self-registered doctors). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const guard = await requireOwnDoctor(auth, id);
  if (guard.error) return guard.error;

  const slots = await prisma.doctorSlot.findMany({
    where: { doctorId: id, startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
  });

  return NextResponse.json({ success: true, data: slots });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const guard = await requireOwnDoctor(auth, id);
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please pick a valid date and time.');

  const slot = await prisma.doctorSlot.create({
    data: { doctorId: id, startsAt: new Date(parsed.data.startsAt) },
  });

  return NextResponse.json({ success: true, data: slot }, { status: 201 });
}
