import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import {
  extractPrescription,
  isConfigured,
  type PrescriptionExtraction,
} from '@/lib/prescription-ai';
import { uploadToStorage, isStorageConfigured } from '@/lib/storage';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export async function GET(req: NextRequest) {
  try {
    const guard = await requireHealthAccess(req);
    if (guard instanceof Response) return guard;

    const prescriptions = await prisma.prescription.findMany({
      where: { userId: guard.elderUserId },
      include: {
        uploadedBy: { select: { name: true } },
        medications: { select: { id: true, name: true, dosage: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(prescriptions);
  } catch (err) {
    console.error('Prescription list error:', err instanceof Error ? err.message : err);
    return fail('SERVER_ERROR', 'Could not load prescriptions right now. Please try again.', 500);
  }
}

// Whatever goes wrong inside, the person always gets a readable JSON answer (never a blank
// 500 page), and the real reason is written to the server log.
export async function POST(req: NextRequest) {
  try {
    return await handleUpload(req);
  } catch (err) {
    console.error('Prescription upload crashed:', err instanceof Error ? err.stack || err.message : err);
    return fail('SERVER_ERROR', 'Something went wrong while saving the prescription. Please try again.', 500);
  }
}

async function handleUpload(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const file = formData.get('file') as File | null;
  const elderUserId = formData.get('elderUserId') as string | null;

  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return fail('VALIDATION', 'Only JPEG, PNG, and WebP images are accepted.');
  }
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 10 MB.');

  const guard = await requireHealthAccess(req, elderUserId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You need medication management permission.', 403);
  }
  if (!isStorageConfigured()) return fail('NOT_CONFIGURED', 'Photo uploads are not available right now.', 503);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${guard.elderUserId}_${Date.now()}.${ext}`;
    let filePath: string;
    try {
      filePath = await uploadToStorage(`prescriptions/${filename}`, buffer, file.type);
    } catch (storageErr) {
      console.error('Prescription photo storage error:', storageErr instanceof Error ? storageErr.message : storageErr);
      return fail('STORAGE_FAILED', 'The photo could not be stored (file storage problem). Please tell EC support.', 502);
    }

    let extraction: PrescriptionExtraction = {
      doctorName: null,
      hospitalName: null,
      prescriptionDate: null,
      medications: [],
      notes: null,
      nextVisitDate: null,
    };

    let aiProvider: string | undefined;
    if (isConfigured()) {
      const base64 = buffer.toString('base64');
      const result = await extractPrescription(base64, file.type as AllowedType);
      aiProvider = result.provider;
      extraction = result;
    } else {
      extraction.notes =
        'No AI provider configured. Please add medications manually.';
    }

    // Nothing is committed to the medicine calendar yet — the caregiver reviews and
    // edits the AI's reading first, then confirms via POST /prescriptions/[id]/confirm.
    const prescription = await prisma.prescription.create({
      data: {
        userId: guard.elderUserId,
        uploadedById: guard.userId,
        fileName: file.name,
        filePath,
        fileType: file.type,
        extractedData: extraction as object,
        doctorName: extraction.doctorName,
        hospitalName: extraction.hospitalName,
        prescriptionDate: extraction.prescriptionDate
          ? new Date(extraction.prescriptionDate)
          : null,
        notes: extraction.notes,
      },
    });

    return ok(
      {
        prescription,
        extractedMedications: extraction.medications,
        nextVisitDate: extraction.nextVisitDate,
        aiProvider,
      },
      201,
    );
  } catch (err) {
    console.error('Prescription upload error:', err instanceof Error ? err.stack || err.message : err);
    return fail('SERVER_ERROR', 'Could not save the prescription photo. Please try again in a minute.', 500);
  }
}
