import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  type: z.enum(['committee', 'helpdesk']).default('committee'),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  neighborhoodId: z.string().optional(),
});

/**
 * Queries visible to the caller. Committee/admin see every ticket in the community;
 * ordinary residents see only their own — otherwise the help desk would expose every
 * neighbour's complaints to everyone.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const type = req.nextUrl.searchParams.get('type');
  const canSeeAll = guard.membership.role !== 'member';

  const queries = await prisma.committeeQuery.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(canSeeAll ? {} : { userId: guard.auth.userId }),
      ...(type === 'committee' || type === 'helpdesk' ? { type } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { replies: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return ok(queries);
}

/** Raise a query to the committee, or a general help-desk request. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a subject and describe your query.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { type, subject, body } = parsed.data;

  const query = await prisma.committeeQuery.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      userId: guard.auth.userId,
      type,
      subject,
      body,
    },
  });

  return ok(query, 201);
}
