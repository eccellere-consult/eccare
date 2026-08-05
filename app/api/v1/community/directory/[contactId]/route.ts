import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Not found in this directory.' } },
    { status: 404 },
  );

/**
 * A community's committee/admin (or a platform admin) removes a shared neighbor
 * contact from *their* directory. This never touches the owner's personal
 * contact-book entry — it just flips Contact.shareWithNeighbours back to false,
 * the same as the owner un-sharing it themselves. The owner keeps the entry in
 * their own Contacts list and can re-share it later.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, category: true, shareWithNeighbours: true, elderUserId: true },
  });
  if (!contact || contact.category !== 'neighbor' || !contact.shareWithNeighbours) return notFound();

  // Resolves to the caller's own community context (explicit ?neighborhoodId= or
  // their primary), same as every other community route — not just "some"
  // membership the elder happens to have, in case they belong to more than one.
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const membership = await prisma.neighborhoodMember.findUnique({
    where: { neighborhoodId_userId: { neighborhoodId: guard.neighborhoodId, userId: contact.elderUserId } },
    select: { neighborhoodId: true },
  });
  if (!membership) return notFound();

  await prisma.contact.update({ where: { id: contactId }, data: { shareWithNeighbours: false } });
  return ok({ removed: true });
}
