import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB — legal/financial docs can be scanned PDFs
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);
  if (auth.role !== 'admin' && !(await canAccessElder(auth.userId, consultation.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this consultation.", 403);
  }

  const documents = await prisma.vaultDocument.findMany({ where: { consultationRequestId: id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ success: true, data: documents });
}

/** The document vault upload — same R2 object storage as every other file in
 *  this app (encrypted at rest, HTTPS in transit), scoped to one consultation
 *  request. Only the elder/caregiver who owns the consultation (or an admin,
 *  coordinating with the real advisor) can upload or see these. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const consultation = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!consultation) return fail('NOT_FOUND', 'Consultation not found.', 404);
  if (auth.role !== 'admin' && !(await canAccessElder(auth.userId, consultation.elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this consultation.", 403);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.', 400);
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.', 400);
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return fail('VALIDATION', 'Only PDF, JPEG, and PNG files are accepted.', 400);
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 15 MB.', 400);
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'File uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`advisory-vault/${filename}`, buffer, file.type);

    const doc = await prisma.vaultDocument.create({
      data: { consultationRequestId: id, uploadedById: auth.userId, fileName: file.name, filePath, fileType: file.type },
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Advisory vault document upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
