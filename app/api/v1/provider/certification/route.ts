import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'certifications');
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** A provider uploads proof of certification/license — mirrors the prescription
 *  upload pattern (local disk under public/uploads/, same size/type validation
 *  shape) for the admin verification queue to review before approving the account. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only PDF, JPEG, and PNG files are accepted.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext =
      file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${auth.userId}_${Date.now()}.${ext}`;
    const filePath = `/uploads/certifications/${filename}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    const provider = await prisma.serviceProvider.update({
      where: { userId: auth.userId },
      data: { certificationFileName: file.name, certificationFilePath: filePath },
    });

    return NextResponse.json({ success: true, data: provider }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Certification upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
