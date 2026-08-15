import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  mediaType: z.enum(['video', 'music']).optional(),
  description: z.string().max(1000).optional(),
});

/** Family-curated video/music links for an elder to follow — same read/write shape
 *  as /health/appointments: any caller with health access can technically read or
 *  write via this route (requireHealthAccess doesn't itself distinguish a write
 *  permission from canManageMeds), but the elder-facing UI only ever renders the
 *  add form on the caregiver side, matching how Appointments already works. */
export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const links = await prisma.familyMediaLink.findMany({
    where: { userId: guard.elderUserId },
    orderBy: { createdAt: 'desc' },
  });

  return ok(links);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const { elderUserId: _, ...data } = parsed.data;

  const link = await prisma.familyMediaLink.create({
    data: { ...data, userId: guard.elderUserId, addedById: guard.userId },
  });

  return ok(link, 201);
}
