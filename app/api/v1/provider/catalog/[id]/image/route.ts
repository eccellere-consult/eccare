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
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only JPEG and PNG images are accepted.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Photo uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${item.id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`catalog/${filename}`, buffer, file.type);

    const updated = await prisma.catalogItem.update({ where: { id }, data: { imagePath: filePath } });

    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Catalog image upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
