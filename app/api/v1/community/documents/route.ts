import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { requireMembership, ok } from '@/lib/community-route';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'community-documents');
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];
const DOCUMENT_CATEGORIES = ['bylaws', 'minutes', 'notice', 'other'] as const;

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** All committee-uploaded documents for the community — visible to every member. */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const category = req.nextUrl.searchParams.get('category');

  const documents = await prisma.communityDocument.findMany({
    where: {
      neighborhoodId: guard.neighborhoodId,
      ...((DOCUMENT_CATEGORIES as readonly string[]).includes(category ?? '')
        ? { category: category as (typeof DOCUMENT_CATEGORIES)[number] }
        : {}),
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return ok(documents);
}

/** Committee/admin only — creates the document row and saves the file in one step,
 *  mirroring the certification upload pattern (local disk under public/uploads/). */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.', 400);
  }

  const neighborhoodId = (formData.get('neighborhoodId') as string) || undefined;
  const guard = await requireMembership(req, { neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const title = (formData.get('title') as string) || '';
  const category = (formData.get('category') as string) || 'other';
  const file = formData.get('file') as File | null;

  if (!title.trim()) return fail('VALIDATION', 'Please enter a title.', 400);
  if (!file) return fail('VALIDATION', 'No file uploaded.', 400);
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only PDF, JPEG, and PNG files are accepted.', 400);
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 15 MB.', 400);
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
    return fail('VALIDATION', 'Invalid category.', 400);
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${guard.neighborhoodId}_${Date.now()}.${ext}`;
    const filePath = `/uploads/community-documents/${filename}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    const document = await prisma.communityDocument.create({
      data: {
        neighborhoodId: guard.neighborhoodId,
        title,
        category: category as (typeof DOCUMENT_CATEGORIES)[number],
        fileName: file.name,
        filePath,
        fileType: file.type,
        uploadedById: guard.auth.userId,
      },
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Community document upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
