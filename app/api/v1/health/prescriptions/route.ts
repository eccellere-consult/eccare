import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import {
  extractPrescription,
  isConfigured,
  type PrescriptionExtraction,
} from '@/lib/prescription-ai';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'prescriptions');
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
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

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${guard.elderUserId}_${Date.now()}.${ext}`;
    const filePath = `/uploads/prescriptions/${filename}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    let extraction: PrescriptionExtraction = {
      doctorName: null,
      hospitalName: null,
      prescriptionDate: null,
      medications: [],
      notes: null,
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

    const createdMeds = [];
    if (extraction.medications.length > 0) {
      for (const med of extraction.medications) {
        const medication = await prisma.medication.create({
          data: {
            userId: guard.elderUserId,
            prescriptionId: prescription.id,
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            timeSlots: med.timeSlots,
            instructions: med.instructions,
            prescribingDoctor: extraction.doctorName,
          },
        });
        createdMeds.push(medication);
      }

      const today = new Date().toISOString().split('T')[0];
      for (const med of createdMeds) {
        const slots = med.timeSlots as string[];
        for (const slot of slots) {
          const scheduledAt = new Date(`${today}T${slot}:00.000Z`);
          const existing = await prisma.medicationReminder.findFirst({
            where: { medicationId: med.id, scheduledAt },
          });
          if (!existing) {
            await prisma.medicationReminder.create({
              data: {
                medicationId: med.id,
                userId: guard.elderUserId,
                scheduledAt,
              },
            });
          }
        }
      }
    }

    return ok(
      {
        prescription,
        extractedMedications: extraction.medications,
        createdMedications: createdMeds.length,
        aiProvider,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed unexpectedly.';
    console.error('Prescription upload error:', message);
    return fail('SERVER_ERROR', message, 500);
  }
}
