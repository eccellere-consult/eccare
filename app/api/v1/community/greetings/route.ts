import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { getMembership } from '@/lib/community-access';

const schema = z.object({
  toUserId: z.string().min(1),
  message: z.string().max(280).optional(),
  neighborhoodId: z.string().optional(),
});

/** Greetings received by the caller. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const greetings = await prisma.greeting.findMany({
    where: { toUserId: guard.auth.userId, neighborhoodId: guard.neighborhoodId },
    include: { fromUser: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok(greetings);
}

/** "Drop a hello" to a neighbour. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidInput('Please choose a neighbour to greet.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { toUserId, message } = parsed.data;

  if (toUserId === guard.auth.userId) {
    return invalidInput("You can't greet yourself.");
  }

  // The recipient must be in the same community — otherwise this becomes an open DM
  // channel to any user id, which is exactly what the per-neighbourhood scoping is
  // meant to prevent.
  const recipientMembership = await getMembership(toUserId, guard.neighborhoodId);
  if (!recipientMembership) {
    return invalidInput('That person is not in your community.');
  }

  const greeting = await prisma.greeting.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      fromUserId: guard.auth.userId,
      toUserId,
      message: message?.trim() || null,
    },
    include: { toUser: { select: { id: true, name: true } } },
  });

  return ok(greeting, 201);
}
