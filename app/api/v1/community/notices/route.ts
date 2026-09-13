import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { getElderNeighborhoodId } from '@/lib/community-access';

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  pinned: z.boolean().optional(),
  neighborhoodId: z.string().optional(),
});

/** Announcements, pinned ones first.
 *
 *  With ?elderUserId=, a caregiver reads THEIR elder's announcements instead of
 *  their own — read-only, no posting, and deliberately bypasses requireMembership
 *  (the caregiver isn't a member of the elder's community at all). See
 *  getElderNeighborhoodId for the isolation rationale. */
export async function GET(req: NextRequest) {
  const elderUserId = req.nextUrl.searchParams.get('elderUserId');
  if (elderUserId) {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
    }
    const neighborhoodId = await getElderNeighborhoodId(auth.userId, elderUserId);
    if (neighborhoodId === null) {
      if (!(await canAccessElder(auth.userId, elderUserId))) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this elder.' } }, { status: 403 });
      }
      return ok([]); // elder hasn't joined a community yet
    }
    const notices = await prisma.notice.findMany({
      where: { neighborhoodId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return ok(notices);
  }

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
