import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  pinned: z.boolean().optional(),
  neighborhoodId: z.string().optional(),
});

/** Announcements, pinned ones first. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const notices = await prisma.notice.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return ok(notices);
}

/** Committee-only — announcements carry implicit authority, so residents shouldn't
 *  be able to post them. Residents raise things via the help desk instead. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a title and message.');

  const guard = await requireMembership(req, {
    manage: true,
    neighborhoodId: parsed.data.neighborhoodId,
  });
  if (guard.error) return guard.error;

  const { title, body, pinned } = parsed.data;

  const notice = await prisma.notice.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      title,
      body,
      pinned: pinned ?? false,
      createdById: guard.auth.userId,
    },
  });

  return ok(notice, 201);
}
