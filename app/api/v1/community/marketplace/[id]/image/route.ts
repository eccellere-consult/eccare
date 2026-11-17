import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMembership } from '@/lib/community-route';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';
import { sniffUploadType, describeUploadError } from '@/lib/upload-guard';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Upload a photo for a marketplace listing — mirrors the catalog-item image upload
 *  pattern (R2 object storage via lib/storage.ts), owner-only. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Safety net: anything that goes wrong anywhere below still comes back as a readable message,
  // never as a blank server error page.
  try {
    return await handleUpload(req, ctx);
  } catch (err) {
    const detail = describeUploadError(err);
    console.error('Marketplace image upload crashed:', detail);
    return fail('SERVER_ERROR', `The photo could not be saved (${detail}).`, 500);
  }
}

async function handleUpload(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);

  const guard = await requireMembership(req, { neighborhoodId: listing.neighborhoodId });
  if (guard.error) return guard.error;
  if (guard.auth.userId !== listing.postedById) {
    return fail('FORBIDDEN', 'You can only add a photo to your own listing.', 403);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Photo uploads are not available right now.', 503);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // Judge the picture by what it really is, not by the label the phone gave it: a camera photo
    // can arrive with an empty or odd type even though it is a perfectly good JPEG.
    const type = sniffUploadType(buffer);
    if (!type) return fail('VALIDATION', 'Only JPEG and PNG images are accepted.');
    const ext = type === 'image/png' ? 'png' : 'jpg';
    const filename = `${id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`marketplace/${filename}`, buffer, type);

    const updated = await prisma.marketplaceListing.update({ where: { id }, data: { imagePath: filePath } });

    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    const detail = describeUploadError(err);
    console.error('Marketplace image upload error:', detail);
    return fail('SERVER_ERROR', `The photo store did not accept the file (${detail}).`, 500);
  }
}
