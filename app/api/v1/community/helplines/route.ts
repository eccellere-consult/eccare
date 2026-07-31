import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  label: z.string().min(1).max(120),
  phone: z.string().min(3).max(20),
  category: z.string().max(40).optional(),
  sortOrder: z.number().int().optional(),
  neighborhoodId: z.string().optional(),
});

/** Quick-access community helpline numbers. Read by any member. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const helplines = await prisma.communityHelpline.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(helplines);
}

/** Committee-only: these are safety-critical numbers, so ordinary members can't edit
 *  them (a wrong ambulance number is worse than no number). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a name and phone number.');

  const guard = await requireMembership(req, {
    manage: true,
    neighborhoodId: parsed.data.neighborhoodId,
  });
  if (guard.error) return guard.error;

  const { label, phone, category, sortOrder } = parsed.data;

  const helpline = await prisma.communityHelpline.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      label,
      phone,
      category: category || 'general',
      sortOrder: sortOrder ?? 0,
    },
  });

  return ok(helpline, 201);
}
