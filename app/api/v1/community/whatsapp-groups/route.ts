import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  // Restricted to real WhatsApp invite links so this can't become a general
  // "post any link to the whole community" surface.
  inviteUrl: z.string().url().refine((u) => /^https:\/\/chat\.whatsapp\.com\//i.test(u), {
    message: 'Must be a WhatsApp group invite link (https://chat.whatsapp.com/...)',
  }),
  neighborhoodId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const groups = await prisma.whatsAppGroupLink.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return ok(groups);
}

/** Committee-only: an invite link grants access to an off-platform space EC can't
 *  moderate, so adding one is a trust decision, not a casual post. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return invalidInput(
      parsed.error?.issues?.[0]?.message || 'Please enter a name and a WhatsApp invite link.',
    );
  }

  const guard = await requireMembership(req, {
    manage: true,
    neighborhoodId: parsed.data.neighborhoodId,
  });
  if (guard.error) return guard.error;

  const { name, description, inviteUrl } = parsed.data;

  const group = await prisma.whatsAppGroupLink.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      name,
      description,
      inviteUrl,
      createdById: guard.auth.userId,
    },
  });

  return ok(group, 201);
}
