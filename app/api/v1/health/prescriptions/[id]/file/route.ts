import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, fail } from '@/lib/health-access';
import { getFromStorage } from '@/lib/storage';

/**
 * The photo of one prescription, served from EC's own address to a signed-in person who may see
 * that elder's health data. The phone app shows the website inside a page, where a link out to
 * the storage service's own address does not open reliably; an image on EC's own address does.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: { userId: true, filePath: true },
  });
  if (!prescription) return fail('NOT_FOUND', 'Prescription not found.', 404);

  const guard = await requireHealthAccess(req, prescription.userId);
  if (guard instanceof Response) return guard;

  if (prescription.filePath.startsWith('/uploads/')) {
    return fail('PHOTO_NOT_STORED', 'This older photo is no longer stored. Upload the prescription again to keep a copy.', 404);
  }

  const file = await getFromStorage(prescription.filePath);
  if (file) {
    return new NextResponse(new Uint8Array(file.body), {
      headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=3600' },
    });
  }

  // Could not read it back directly: fall back to the stored public address.
  if (/^https?:\/\//.test(prescription.filePath)) return NextResponse.redirect(prescription.filePath);
  return fail('PHOTO_UNAVAILABLE', 'The prescription photo could not be loaded right now. Please try again.', 502);
}
