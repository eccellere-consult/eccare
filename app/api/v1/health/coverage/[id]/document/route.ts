import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

/** Upload a policy/card image or PDF for a coverage item. Informational, same
 *  permission tier as the rest of Health Essentials — no canManageMeds check. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.healthCoverageItem.findUnique({ where: { id } });
  if (!item) return fail('NOT_FOUND', 'Not found.', 404);

  const guard = await requireHealthAccess(req, item.userId);
  if (guard instanceof Response) return guard;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only JPEG, PNG, and PDF files are accepted.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'File uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'application/pdf' ? 'pdf' : 'jpg';
    const filename = `${item.userId}_${id}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`health-coverage/${filename}`, buffer, file.type);

    const updated = await prisma.healthCoverageItem.update({
      where: { id },
      data: { filePath, fileName: file.name, fileType: file.type },
      include: { addedBy: { select: { name: true, role: true } } },
    });

    return ok(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Health coverage document upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
