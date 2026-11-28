import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { deleteFromStorage } from '@/lib/storage';
import { careStaffProviderFor, fail, LISTING_INCLUDE, serialiseListing } from '@/lib/care-staff-server';

/** Removes one document (and its file) from a person's listing. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const provider = await careStaffProviderFor(auth.userId);
  if (!provider) return fail('FORBIDDEN', 'This page is for home-care staff providers.', 403);
  const { id, docId } = await params;

  const doc = await prisma.careStaffDocument.findFirst({
    where: { id: docId, listingId: id, listing: { providerId: provider.id } },
    select: { id: true, filePath: true },
  });
  if (!doc) return fail('NOT_FOUND', 'Document not found.', 404);

  await prisma.careStaffDocument.delete({ where: { id: doc.id } });
  await deleteFromStorage(doc.filePath).catch(() => {});
  const updated = await prisma.careStaffListing.findUniqueOrThrow({ where: { id }, include: LISTING_INCLUDE });
  return NextResponse.json({ success: true, data: serialiseListing(updated) });
}
