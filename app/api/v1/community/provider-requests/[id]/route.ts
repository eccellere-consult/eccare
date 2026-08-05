import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } },
    { status: 404 },
  );

/** The community's own approval step — only valid while the request is still
 *  `pending`. Moves it to `communityApproved` (awaiting the platform admin next) or
 *  `rejected`. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const request = await prisma.communityProviderListing.findUnique({ where: { id } });
  if (!request) return notFound();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: request.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  if (request.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_STATE', message: 'This request has already been decided.' } },
      { status: 409 },
    );
  }

  const updated = await prisma.communityProviderListing.update({
    where: { id },
    data:
      parsed.data.action === 'approve'
        ? { status: 'communityApproved', communityApprovedAt: new Date(), communityApprovedById: guard.auth.userId }
        : {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedById: guard.auth.userId,
            rejectionReason: parsed.data.rejectionReason,
          },
  });

  return ok(updated);
}
