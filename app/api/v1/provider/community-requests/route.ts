import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({
  joinCode: z.string().min(4).max(32),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** The provider's own connection requests, across every community. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const requests = await prisma.communityProviderListing.findMany({
    where: { providerId: provider.id },
    include: { neighborhood: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: requests });
}

/** A verified provider requests to be listed in a community, by its join code.
 *  Requires ServiceProvider.verificationStatus === 'verified' — identity/certification
 *  review already happened at the platform level; this reuses that check rather than
 *  duplicating it. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please enter a valid community code.', 400);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);
  if (provider.verificationStatus !== 'verified') {
    return fail(
      'NOT_VERIFIED',
      'Your account needs to be verified by EC before you can request to join a community.',
      403,
    );
  }

  const neighborhood = await prisma.neighborhood.findUnique({
    where: { joinCode: parsed.data.joinCode.trim().toUpperCase() },
  });
  if (!neighborhood) return fail('NOT_FOUND', 'No community found with that code.', 404);

  const existing = await prisma.communityProviderListing.findUnique({
    where: { providerId_neighborhoodId: { providerId: provider.id, neighborhoodId: neighborhood.id } },
  });
  if (existing) {
    return fail('ALREADY_REQUESTED', "You've already requested to join this community.", 409);
  }

  const request = await prisma.communityProviderListing.create({
    data: { providerId: provider.id, neighborhoodId: neighborhood.id },
    include: { neighborhood: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: request }, { status: 201 });
}
