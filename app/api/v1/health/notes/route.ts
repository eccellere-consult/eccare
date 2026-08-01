import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const notes = await prisma.healthNote.findMany({
    where: { userId: guard.elderUserId },
    include: { createdBy: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok(notes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const note = await prisma.healthNote.create({
    data: {
      content: parsed.data.content,
      userId: guard.elderUserId,
      createdById: guard.userId,
    },
    include: { createdBy: { select: { name: true, role: true } } },
  });

  return ok(note, 201);
}
