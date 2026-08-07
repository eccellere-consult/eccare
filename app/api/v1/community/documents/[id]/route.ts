import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Document not found.' } },
    { status: 404 },
  );

/** Remove a document — committee/admin only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const document = await prisma.communityDocument.findUnique({ where: { id } });
  if (!document) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: document.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  await prisma.communityDocument.delete({ where: { id } });

  return ok(null);
}
