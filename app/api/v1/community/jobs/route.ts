import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  postingType: z.enum(['job_offered', 'job_wanted', 'resource_offered', 'resource_wanted']),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  compensation: z.string().max(120).optional(),
  contactPhone: z.string().min(3).max(20),
  houseNumber: z.string().max(40).optional(),
  preferredContactTime: z.string().max(120).optional(),
  neighborhoodId: z.string().optional(),
});

/** All job/resource postings for the community, optionally filtered by type. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const postingType = req.nextUrl.searchParams.get('postingType');

  const postings = await prisma.communityJobPosting.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...(postingType
        ? { postingType: postingType as 'job_offered' | 'job_wanted' | 'resource_offered' | 'resource_wanted' }
        : {}),
    },
    include: { postedBy: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return ok(postings);
}

/** Any member can post — peer-to-peer classifieds, no committee gate. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return invalidInput('Please enter a title, a contact number, and pick a posting type.');
  }

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId });
  if (guard.error) return guard.error;

  const { postingType, title, description, compensation, contactPhone, houseNumber, preferredContactTime } = parsed.data;

  const posting = await prisma.communityJobPosting.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      postedById: guard.auth.userId,
      postingType,
      title,
      description,
      compensation,
      contactPhone,
      houseNumber,
      preferredContactTime,
    },
  });

  return ok(posting, 201);
}
