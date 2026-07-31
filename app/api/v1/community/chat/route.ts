import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  body: z.string().min(1).max(2000),
  neighborhoodId: z.string().optional(),
});

/** Community Buzz messages, oldest-first for natural chat rendering.
 *  `?before=<iso>` pages backwards through history. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const before = req.nextUrl.searchParams.get('before');

  const messages = await prisma.chatMessage.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok(messages.reverse());
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please type a message.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const message = await prisma.chatMessage.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      senderId: guard.auth.userId,
      body: parsed.data.body.trim(),
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return ok(message, 201);
}
