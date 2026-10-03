import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { invalidInput, ok } from '@/lib/community-route';
import { reconcileMemberWithDirectory } from '@/lib/directory-link';
import { normalizeHouseInput } from '@/lib/house';

const schema = z.object({
  joinCode: z.string().min(4).max(32),
  // Mandatory — checked below (not by zod) so a missing/invalid one gets the house-number
  // message rather than the generic "enter a valid community code".
  flatNumber: z.string().max(40).optional(),
});

/** Join a neighbourhood using its share code. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a valid community code.');

  const { joinCode } = parsed.data;
  const house = normalizeHouseInput(parsed.data.flatNumber);
  if (!house.ok) return invalidInput(house.message);
  const flatNumber = house.value;

  const neighborhood = await prisma.neighborhood.findUnique({
    where: { joinCode: joinCode.trim().toUpperCase() },
  });
  if (!neighborhood) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'No community found with that code.' } },
      { status: 404 },
    );
  }

  const existing = await prisma.neighborhoodMember.findUnique({
    where: { neighborhoodId_userId: { neighborhoodId: neighborhood.id, userId: auth.userId } },
  });
  if (existing && existing.status !== 'rejected') {
    return ok({
      neighborhood,
      alreadyMember: true,
      status: existing.status,
    });
  }

  // A brand-new community has nobody able to approve a join yet — auto-approve so
  // it isn't deadlocked, exactly like it worked before approval existed at all.
  // Once it has at least one approved committee/admin member, every subsequent
  // join goes through them.
  const hasApprover = await prisma.neighborhoodMember.findFirst({
    where: { neighborhoodId: neighborhood.id, status: 'approved', role: { in: ['committee', 'admin'] } },
    select: { id: true },
  });
  const status = hasApprover ? 'pending' : 'approved';

  // A previously-rejected request re-requests rather than staying locked out
  // forever — same bootstrap rule re-applied, since a new committee may have
  // formed (or dissolved) since the rejection.
  const member = existing
    ? await prisma.neighborhoodMember.update({
        where: { id: existing.id },
        data: { status, flatNumber, approvedAt: null, approvedById: null, rejectionReason: null },
      })
    : await prisma.neighborhoodMember.create({
        data: { neighborhoodId: neighborhood.id, userId: auth.userId, flatNumber, status },
      });

  // Connect them to the entry the community's admin may already have put in the
  // directory for them: same phone links automatically, a plausible resemblance
  // is queued for the committee (see lib/directory-link.ts). Never allowed to
  // fail the join itself.
  try {
    await reconcileMemberWithDirectory(neighborhood.id, auth.userId);
  } catch (err) {
    console.error('[directory-link] reconcile failed:', err instanceof Error ? err.message : err);
  }

  return ok({ neighborhood, alreadyMember: false, status: member.status }, 201);
}
