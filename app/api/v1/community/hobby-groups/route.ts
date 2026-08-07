import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const HOBBY_CATEGORIES = ['art', 'music', 'dance', 'theatre', 'books', 'discussion', 'teaching', 'other'] as const;

const schema = z.object({
  name: z.string().min(1).max(160),
  category: z.enum(HOBBY_CATEGORIES),
  description: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All hobby groups for the community, optionally filtered by category — includes
 *  member count and whether the caller has already joined, so the UI can show a
 *  Join/Leave button without a second round-trip. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');

  const groups = await prisma.hobbyGroup.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...((HOBBY_CATEGORIES as readonly string[]).includes(category ?? '')
        ? { category: category as (typeof HOBBY_CATEGORIES)[number] }
        : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true } },
      members: { where: { userId: guard.auth.userId }, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      description: g.description,
      createdBy: g.createdBy,
      memberCount: g._count.members,
      isMember: g.members.length > 0,
      createdAt: g.createdAt,
    })),
  );
}

/** Any member can create a group; the creator is automatically its first member. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name and pick a category.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { name, category, description } = parsed.data;

  const group = await prisma.hobbyGroup.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      category,
      description,
      createdById: guard.auth.userId,
      members: { create: { userId: guard.auth.userId } },
    },
  });

  return ok(group, 201);
}
