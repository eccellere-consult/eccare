import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB — short inspection videos are bigger than photos
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Self-service — mirrors admin/property-inspections/[id]/media exactly,
 *  gated on the provider owning the inspection's subscription instead of
 *  admin role. Called once per file, same as the admin path. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const { id } = await params;
  const inspection = await prisma.propertyInspection.findUnique({ where: { id }, include: { subscription: true } });
  if (!inspection) return fail('NOT_FOUND', 'Inspection not found.', 404);
  if (inspection.subscription.providerId !== provider.id) return fail('FORBIDDEN', "This isn't yours to update.", 403);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return fail('VALIDATION', 'Only JPEG/PNG photos or MP4/MOV videos are accepted.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 25 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`property-inspections/${filename}`, buffer, file.type);

    const existing = Array.isArray(inspection.mediaPaths) ? (inspection.mediaPaths as string[]) : [];
    const updated = await prisma.propertyInspection.update({
      where: { id },
      data: { mediaPaths: [...existing, filePath] },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Property inspection media upload error (self-service):', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
