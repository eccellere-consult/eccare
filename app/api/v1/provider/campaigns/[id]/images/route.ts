import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { deleteFromStorage, isStorageConfigured, uploadToStorage } from '@/lib/storage';
import { sniffUploadType, describeUploadError } from '@/lib/upload-guard';
import { MAX_IMAGES } from '@/lib/campaigns';
import { fail, imagesOf, providerFor, serialiseCampaign } from '@/lib/campaigns-server';

const MAX_SIZE = 5 * 1024 * 1024; // photos are shrunk on the phone first

async function ownDraft(userId: string, id: string) {
  const provider = await providerFor(userId);
  if (!provider) return null;
  return prisma.campaign.findFirst({ where: { id, providerId: provider.id } });
}

/** Adds one photo (JPEG or PNG, checked from the file's own bytes) to an unpaid offer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const campaign = await ownDraft(auth.userId, id);
  if (!campaign) return fail('NOT_FOUND', 'Not found.', 404);
  if (campaign.status !== 'draft') return fail('BAD_STATE', 'Photos can only be changed before paying.');
  const images = imagesOf(campaign);
  if (images.length >= MAX_IMAGES) return fail('TOO_MANY', `Up to ${MAX_IMAGES} photos.`);
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Photo uploads are not available right now.', 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the photo.');
  }
  const file = form.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No photo uploaded.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'Photo must be under 5 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffUploadType(bytes);
  if (!type) return fail('VALIDATION', 'Only JPEG or PNG photos are accepted.');

  try {
    const url = await uploadToStorage(`campaigns/${randomUUID()}.${type === 'image/png' ? 'png' : 'jpg'}`, bytes, type);
    const updated = await prisma.campaign.update({
      where: { id },
      data: { imagePaths: [...images, url] },
      include: { enquiries: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    return NextResponse.json({ success: true, data: serialiseCampaign(updated) }, { status: 201 });
  } catch (err) {
    return fail('UPLOAD_FAILED', describeUploadError(err), 500);
  }
}

/** Removes the photo at ?index=n from an unpaid offer. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const campaign = await ownDraft(auth.userId, id);
  if (!campaign) return fail('NOT_FOUND', 'Not found.', 404);
  if (campaign.status !== 'draft') return fail('BAD_STATE', 'Photos can only be changed before paying.');
  const images = imagesOf(campaign);
  const index = Number(req.nextUrl.searchParams.get('index'));
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return fail('NOT_FOUND', 'Photo not found.', 404);

  const updated = await prisma.campaign.update({
    where: { id },
    data: { imagePaths: images.filter((_, i) => i !== index) },
    include: { enquiries: { orderBy: { createdAt: 'desc' }, take: 100 } },
  });
  await deleteFromStorage(images[index]).catch(() => {});
  return NextResponse.json({ success: true, data: serialiseCampaign(updated) });
}
