import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Upload a catalog item's photo — mirrors the certification upload pattern
 *  (R2 object storage via lib/storage.ts) with the same size validation shape,
 *  JPEG/PNG only this time. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Safety net: anything that goes wrong anywhere below still comes back as a readable message,
  // never as a blank server error page.
  try {
    return await handleUpload(req, ctx);
  } catch (err) {
    const e = err as { name?: string; message?: string } | null;
    const detail = [e?.name, e?.message].filter(Boolean).join(', ') || 'unknown error';
    console.error('Catalog image upload crashed:', detail);
    return fail('SERVER_ERROR', `The photo could not be saved (${detail.slice(0, 160)}).`, 500);
  }
}

async function handleUpload(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({ where: { id }, include: { provider: true } });
  if (!item) return fail('NOT_FOUND', 'Item not found.', 404);
  if (item.provider.userId !== auth.userId) {
    return fail('FORBIDDEN', "You don't have access to this item.", 403);
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
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    // Judge the picture by what it really is, not by the label the phone gave it: a camera photo
    // can arrive with an empty or odd type even though it is a perfectly good JPEG.
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const type: AllowedType | null = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : null;
    if (!type) return fail('VALIDATION', 'Only JPEG and PNG images are accepted.');
    const ext = type === 'image/png' ? 'png' : 'jpg';
    const filename = `${item.id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`catalog/${filename}`, buffer, type);

    const updated = await prisma.catalogItem.update({ where: { id }, data: { imagePath: filePath } });

    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    // The storage library sometimes throws an error with an empty message, which used to reach the
    // provider as a bare "Something went wrong". Always name what failed (error name + the storage
    // service's HTTP status when it gave one) so the real cause can be found and fixed.
    const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } | null;
    const status = e?.$metadata?.httpStatusCode;
    const detail = [e?.name, status ? `HTTP ${status}` : '', e?.message].filter(Boolean).join(', ') || 'unknown error';
    console.error('Catalog image upload error:', detail);
    return fail('SERVER_ERROR', `The photo store did not accept the file (${detail.slice(0, 160)}).`, 500);
  }
}
