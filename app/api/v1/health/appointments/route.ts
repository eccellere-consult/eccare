import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  doctorName: z.string().min(1).max(200),
  hospital: z.string().max(200).optional(),
  specialty: z.string().max(100).optional(),
  datetime: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const showPast = req.nextUrl.searchParams.get('all') === '1';

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: guard.elderUserId,
      ...(showPast ? {} : { status: 'upcoming', datetime: { gte: new Date() } }),
    },
    orderBy: { datetime: 'asc' },
  });

  return ok(appointments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { elderUserId: _, ...data } = parsed.data;

  const appointment = await prisma.appointment.create({
    data: { ...data, datetime: new Date(data.datetime), userId: guard.elderUserId },
  });

  return ok(appointment, 201);
}
