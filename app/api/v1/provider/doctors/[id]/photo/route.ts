import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { requireOwnDoctor } from '@/lib/provider-doctor-access';
import { uploadToStorage, deleteFromStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — a profile photo, not a document scan
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Self-service photo upload — mirrors
 *  community/doctors/[id]/photo (the admin/committee path) exactly, just
 *  gated on the caller owning this listing instead of community membership. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const { id } = await params;
  const guard = await requireOwnDoctor(auth, id);
  if (guard.error) return guard.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return fail('VALIDATION', 'Only JPEG, PNG, or WebP photos are accepted.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'Photo must be under 5 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = await uploadToStorage(`doctors/${id}_${Date.now()}.${ext}`, buffer, file.type);

    if (guard.doctor.photoPath) await deleteFromStorage(guard.doctor.photoPath);

    const updated = await prisma.localDoctor.update({ where: { id }, data: { photoPath: filePath } });
    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Doctor self-service photo upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
