import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const MOOD_VALUES = ['great', 'good', 'okay', 'low', 'not_well'] as const;

const createSchema = z.object({
  elderUserId: z.string().optional(),
  mood: z.enum(MOOD_VALUES),
});

/** Daily mood check-ins, part of the AI Companion. Informational, same permission
 *  tier as HealthNote for reading — any caregiver with canViewHealth can see the
 *  trend. Writing is elder-self only (see POST below): a caregiver answering "how
 *  are you feeling" on the elder's behalf would defeat the point of a self-report. */
export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const logs = await prisma.moodLog.findMany({
    where: { userId: guard.elderUserId },
    orderBy: { createdAt: 'desc' },
    take: 14,
  });

  return ok(logs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  if (guard.role !== 'elder') {
    return fail('FORBIDDEN', 'Only the elder can log their own mood.', 403);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const log = await prisma.moodLog.create({
    data: { userId: guard.elderUserId, mood: parsed.data.mood },
  });

  return ok(log, 201);
}
