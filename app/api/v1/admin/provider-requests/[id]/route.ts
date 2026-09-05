import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Platform admin's final sign-off. Approve is only valid once the community has
 *  already approved (`communityApproved`) — enforces the stated order rather than
 *  letting the platform admin short-circuit the community's own review. On approve,
 *  creates the verified LocalListing and links it, all in one transaction. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please check the details and try again.', 400);

  const request = await prisma.communityProviderListing.findUnique({
    where: { id },
    include: { provider: true },
  });
  if (!request) return fail('NOT_FOUND', 'Request not found.', 404);

  if (parsed.data.action === 'reject') {
    if (request.status === 'approved') {
      return fail('INVALID_STATE', 'This request is already approved and listed.', 409);
    }
    const updated = await prisma.communityProviderListing.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedById: auth.userId,
        rejectionReason: parsed.data.rejectionReason,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // action === 'approve'
  if (request.status !== 'communityApproved') {
    return fail(
      'NOT_YET_COMMUNITY_APPROVED',
      "The community hasn't approved this request yet — platform approval comes second.",
      409,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Auto & Taxi providers get their own AutoDriver row instead of a
    // generic vendor listing — Auto Booking (/community/auto-booking) is
    // its own dedicated directory, not part of Vendors, so a LocalListing
    // here would just be a second, unused entry nobody browses.
    if (request.provider.category === 'auto_transport') {
      await tx.autoDriver.create({
        data: {
          neighborhoodId: request.neighborhoodId,
          name: request.provider.businessName,
          phone: request.provider.phone ?? '',
          serviceArea: request.provider.serviceArea,
          providerId: request.provider.id,
        },
      });

      return tx.communityProviderListing.update({
        where: { id },
        data: { status: 'approved', platformApprovedAt: new Date(), platformApprovedById: auth.userId },
      });
    }

    // Doctors are their own dedicated directory too (booking + slots), not a
    // generic vendor listing. ServiceProvider has no specialty/fee field —
    // 'General'/0 are placeholders the doctor is expected to replace via
    // their own profile before the listing is really useful (same posture
    // as an Auto driver's rates starting null).
    if (request.provider.category === 'doctor') {
      await tx.localDoctor.create({
        data: {
          neighborhoodId: request.neighborhoodId,
          name: request.provider.businessName,
          phone: request.provider.phone ?? '',
          locality: request.provider.serviceArea,
          specialty: 'General',
          consultationFee: 0,
          addedById: auth.userId,
          providerId: request.provider.id,
        },
      });

      return tx.communityProviderListing.update({
        where: { id },
        data: { status: 'approved', platformApprovedAt: new Date(), platformApprovedById: auth.userId },
      });
    }

    const listing = await tx.localListing.create({
      data: {
        neighborhoodId: request.neighborhoodId,
        name: request.provider.businessName,
        category: request.provider.category,
        phone: request.provider.phone ?? '',
        address: request.provider.address,
        description: request.provider.description,
        addedById: auth.userId,
        verified: true,
      },
    });

    return tx.communityProviderListing.update({
      where: { id },
      data: {
        status: 'approved',
        platformApprovedAt: new Date(),
        platformApprovedById: auth.userId,
        localListingId: listing.id,
      },
      include: { localListing: true },
    });
  });

  return NextResponse.json({ success: true, data: updated });
}
