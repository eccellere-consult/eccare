import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getFromStorage } from '@/lib/storage';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Shows one home-care staff document, only to EC admins and the provider who uploaded it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { docId } = await params;

  const doc = await prisma.careStaffDocument.findUnique({
    where: { id: docId },
    select: { filePath: true, fileName: true, contentType: true, listing: { select: { provider: { select: { userId: true } } } } },
  });
  if (!doc) return fail('NOT_FOUND', 'Document not found.', 404);
  const allowed = auth.role === 'admin' || doc.listing.provider.userId === auth.userId;
  if (!allowed) return fail('NOT_FOUND', 'Document not found.', 404);

  const file = await getFromStorage(doc.filePath);
  if (!file) return fail('NOT_FOUND', 'The file could not be found.', 404);
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      'Content-Type': doc.contentType || file.contentType,
      'Content-Disposition': `inline; filename="${doc.fileName.replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
