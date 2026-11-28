import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';
import { DOC_KINDS, type DocKind } from '@/lib/care-staff';
import { careStaffProviderFor, fail, LISTING_INCLUDE, readCertificate, serialiseListing } from '@/lib/care-staff-server';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_DOCS = 12;

/**
 * Uploads one document for a person: photo ID, certificate, police verification or photo.
 * Stored under a random name (never guessable) and shown only through the app to this
 * provider and EC admins. A certificate photo is read by the AI for the admin (name,
 * qualification, expiry); ID proofs are never sent to the AI.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const provider = await careStaffProviderFor(auth.userId);
  if (!provider) return fail('FORBIDDEN', 'This page is for home-care staff providers.', 403);
  const { id } = await params;
  const listing = await prisma.careStaffListing.findFirst({
    where: { id, providerId: provider.id },
    select: { id: true, personName: true, status: true, _count: { select: { documents: true } } },
  });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (listing.status === 'rejected') return fail('BAD_STATE', 'EC did not approve this listing.');
  if (listing._count.documents >= MAX_DOCS) return fail('TOO_MANY', `Up to ${MAX_DOCS} documents per person. Please remove one first.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }
  const file = form.get('file') as File | null;
  const kind = String(form.get('kind') ?? '') as DocKind;
  const expiresRaw = String(form.get('expiresOn') ?? '').trim();
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!DOC_KINDS.includes(kind)) return fail('VALIDATION', 'Please choose what this document is.');
  const ext = TYPES[file.type];
  if (!ext) return fail('VALIDATION', 'Only PDF, JPEG, PNG and WebP files are accepted.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'File uploads are not available right now.', 503);
  const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? new Date(`${expiresRaw}T00:00:00Z`) : null;

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const filePath = await uploadToStorage(`care-staff-docs/${randomUUID()}.${ext}`, bytes, file.type);
    const read = kind === 'certificate' ? await readCertificate(bytes, file.type, listing.personName).catch(() => null) : null;

    await prisma.$transaction([
      prisma.careStaffDocument.create({
        data: {
          listingId: id,
          kind,
          fileName: file.name.slice(0, 180) || `document.${ext}`,
          filePath,
          contentType: file.type,
          expiresOn: expiresOn ?? read?.expiresOn ?? null,
          aiNote: read?.note ?? null,
        },
      }),
      // A new document on a checked listing sends it back to EC.
      ...(listing.status === 'approved' || listing.status === 'paused'
        ? [prisma.careStaffListing.update({ where: { id }, data: { status: 'submitted', submittedAt: new Date() } })]
        : []),
    ]);

    const updated = await prisma.careStaffListing.findUniqueOrThrow({ where: { id }, include: LISTING_INCLUDE });
    return NextResponse.json({ success: true, data: serialiseListing(updated) }, { status: 201 });
  } catch (err) {
    console.error('Care staff document upload error:', err instanceof Error ? err.message : err);
    return fail('SERVER_ERROR', 'Upload failed. Please try again.', 500);
  }
}
