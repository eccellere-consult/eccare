import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  timeSlots: z.array(z.string()).min(1),
  instructions: z.string().max(1000).optional(),
  prescribingDoctor: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const showInactive = req.nextUrl.searchParams.get('all') === '1';

  const medications = await prisma.medication.findMany({
    where: { userId: guard.elderUserId, ...(showInactive ? {} : { isActive: true }) },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return ok(medications);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You do not have medication management permission for this elder.', 403);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { elderUserId: _, ...data } = parsed.data;

  const medication = await prisma.medication.create({
    data: { ...data, userId: guard.elderUserId },
  });

  return ok(medication, 201);
}
