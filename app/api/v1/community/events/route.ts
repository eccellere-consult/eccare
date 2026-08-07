import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const EVENT_CATEGORIES = ['cultural', 'local_tour', 'movie', 'social', 'other'] as const;

const schema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  location: z.string().max(200).optional(),
  category: z.enum(EVENT_CATEGORIES).default('other'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  neighborhoodId: z.string().optional(),
});

/** Upcoming community events, with the caller's own RSVP resolved for each. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');

  const events = await prisma.communityEvent.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...((EVENT_CATEGORIES as readonly string[]).includes(category ?? '')
        ? { category: category as (typeof EVENT_CATEGORIES)[number] }
        : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      rsvps: { select: { userId: true, status: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: 100,
  });

  return ok(
    events.map((e) => ({
      ...e,
      rsvps: undefined,
      goingCount: e.rsvps.filter((r) => r.status === 'going').length,
      myRsvp: e.rsvps.find((r) => r.userId === guard.auth.userId)?.status ?? null,
    })),
  );
}

/** Anyone in the community can propose an event — this is intentionally not
 *  committee-only, since resident-run gatherings are most of the value. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please give the event a title and a start time.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { title, description, location, category, startsAt, endsAt } = parsed.data;

  const event = await prisma.communityEvent.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      title,
      description,
      location,
      category,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      createdById: guard.auth.userId,
    },
  });

  return ok(event, 201);
}
