import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Family-private photos — elder + their linked family only, gated by
 *  canAccessElder like every other elder-scoped record (Contact, Order). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's memories.", 403);
  }

  const memories = await prisma.memory.findMany({
    where: { elderUserId },
    include: { addedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: memories });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded photo.');
  }

  const file = formData.get('file') as File | null;
  const elderUserId = (formData.get('elderUserId') as string | null) || auth.userId;
  const caption = (formData.get('caption') as string | null) || null;

  if (!file) return fail('VALIDATION', 'No photo uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only JPEG, PNG, and WebP photos are accepted.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'Photo must be under 10 MB.');
  if (caption && caption.length > 500) return fail('VALIDATION', 'Caption is too long.');

  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's memories.", 403);
  }

  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Photo uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${elderUserId}_${Date.now()}.${ext}`;
    const filePath = await uploadToStorage(`memories/${filename}`, buffer, file.type);

    const memory = await prisma.memory.create({
      data: { elderUserId, addedById: auth.userId, imagePath: filePath, caption },
      include: { addedBy: { select: { name: true } } },
    });

    return NextResponse.json({ success: true, data: memory }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Memory upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
