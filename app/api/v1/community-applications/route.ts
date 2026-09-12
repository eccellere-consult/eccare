import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';
import { isValidPhone, isValidEmail, normalizePhone, PHONE_FORMAT_MESSAGE, EMAIL_FORMAT_MESSAGE } from '@/lib/validation';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ADDITIONAL_DOCS = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

function extFor(type: string): string {
  return type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg';
}

/** Public, unauthenticated — a residents' association, panchayat office, or other
 *  local authority applying to register a new locality on EC has, in the common
 *  case, never used EC before, so this can't require login. Collects the
 *  applicant's own contact details directly (not tied to any User yet) plus the
 *  locality details and supporting documents, and creates a CommunityApplication
 *  for EC admin to review (see /api/v1/admin/community-applications). */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the submitted form.');
  }

  const str = (key: string) => ((formData.get(key) as string) || '').trim();

  const placeName = str('placeName');
  const applicantType = str('applicantType') || undefined;
  const city = str('city') || undefined;
  const pincode = str('pincode');
  const latRaw = str('lat');
  const lngRaw = str('lng');
  const numberOfFamiliesRaw = str('numberOfFamilies');
  const applicantName = str('applicantName');
  const applicantPhoneRaw = str('applicantPhone');
  const applicantEmail = str('applicantEmail') || undefined;
  const applicantDesignation = str('applicantDesignation') || undefined;

  if (!placeName) return fail('VALIDATION', 'Please enter the name of the place or association.');
  if (!pincode) return fail('VALIDATION', 'Please enter the PIN code.');
  if (!applicantName) return fail('VALIDATION', 'Please enter your name.');
  if (!applicantPhoneRaw || !isValidPhone(applicantPhoneRaw)) return fail('VALIDATION', PHONE_FORMAT_MESSAGE);
  if (applicantEmail && !isValidEmail(applicantEmail)) return fail('VALIDATION', EMAIL_FORMAT_MESSAGE);

  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  if ((latRaw && Number.isNaN(lat)) || (lngRaw && Number.isNaN(lng))) {
    return fail('VALIDATION', 'Location looks invalid — please try sharing it again.');
  }
  const numberOfFamilies = numberOfFamiliesRaw ? Number(numberOfFamiliesRaw) : undefined;
  if (numberOfFamiliesRaw && (Number.isNaN(numberOfFamilies) || numberOfFamilies! < 0)) {
    return fail('VALIDATION', 'Please enter a valid number of families.');
  }

  const proofFile = formData.get('proofOfAuthority') as File | null;
  if (!proofFile) return fail('VALIDATION', 'Please attach proof of authority.');
  if (!ALLOWED_TYPES.includes(proofFile.type as AllowedType)) {
    return fail('VALIDATION', 'Only PDF, JPEG, and PNG files are accepted.');
  }
  if (proofFile.size > MAX_SIZE) return fail('VALIDATION', 'Each file must be under 10 MB.');

  const additionalFiles = formData.getAll('additionalDocuments').filter((f): f is File => f instanceof File && f.size > 0);
  if (additionalFiles.length > MAX_ADDITIONAL_DOCS) {
    return fail('VALIDATION', `Please attach no more than ${MAX_ADDITIONAL_DOCS} additional documents.`);
  }
  for (const f of additionalFiles) {
    if (!ALLOWED_TYPES.includes(f.type as AllowedType)) return fail('VALIDATION', 'Only PDF, JPEG, and PNG files are accepted.');
    if (f.size > MAX_SIZE) return fail('VALIDATION', 'Each file must be under 10 MB.');
  }

  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'File uploads are not available right now.', 503);

  try {
    const application = await prisma.communityApplication.create({
      data: {
        placeName,
        applicantType,
        city,
        pincode,
        lat,
        lng,
        numberOfFamilies,
        applicantName,
        applicantPhone: normalizePhone(applicantPhoneRaw),
        applicantEmail,
        applicantDesignation,
      },
    });

    const uploadOne = async (file: File, kind: 'proof_of_authority' | 'additional') => {
      const bytes = await file.arrayBuffer();
      const filename = `${application.id}_${kind}_${Date.now()}_${Math.round(Math.random() * 1e6)}.${extFor(file.type)}`;
      const filePath = await uploadToStorage(`community-applications/${filename}`, Buffer.from(bytes), file.type);
      return prisma.communityApplicationDocument.create({
        data: { applicationId: application.id, kind, fileName: file.name, filePath, fileType: file.type },
      });
    };

    await uploadOne(proofFile, 'proof_of_authority');
    for (const f of additionalFiles) await uploadOne(f, 'additional');

    return NextResponse.json({ success: true, data: { id: application.id } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not submit the application.';
    console.error('Community application error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
