import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { extractPrescriptionData } from '@/lib/claude';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

const uploadSchema = z.object({
  elderUserId: z.string().optional(),
  fileData: z.string(), // base64 encoded
  fileName: z.string(),
  fileType: z.string(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const elderUserId = searchParams.get('elderUserId');
  const targetUserId = elderUserId || auth.userId;

  const prescriptions = await prisma.prescription.findMany({
    where: { userId: targetUserId },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      medications: { where: { isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: prescriptions });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid file data.' } },
      { status: 400 },
    );
  }

  const { elderUserId, fileData, fileName, fileType } = parsed.data;
  const targetUserId = elderUserId || auth.userId;

  // Verify caregiver has permission if uploading for someone else
  if (elderUserId && elderUserId !== auth.userId) {
    const relation = await prisma.familyRelation.findFirst({
      where: {
        elderUserId: elderUserId,
        caregiverUserId: auth.userId,
        canManageMeds: true,
        inviteStatus: 'accepted',
      },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'No permission to upload prescriptions for this user.' } },
        { status: 403 },
      );
    }
  }

  try {
    // Save file to uploads directory
    const uploadsDir = join(process.cwd(), 'uploads', 'prescriptions');
    await mkdir(uploadsDir, { recursive: true });

    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = join(uploadsDir, uniqueFileName);

    // Convert base64 to buffer and save
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(filePath, buffer);

    const fileSize = buffer.length;

    // Create prescription record (initially pending)
    const prescription = await prisma.prescription.create({
      data: {
        userId: targetUserId,
        uploadedById: auth.userId,
        fileName: uniqueFileName,
        filePath: `/uploads/prescriptions/${uniqueFileName}`,
        fileType,
        fileSize,
        status: 'pending',
      },
    });

    // Process extraction asynchronously
    processExtraction(prescription.id, base64Data, fileType, targetUserId).catch(console.error);

    return NextResponse.json(
      {
        success: true,
        data: prescription,
        message: 'Prescription uploaded. Processing in background...',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Prescription upload error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload prescription.' } },
      { status: 500 },
    );
  }
}

async function processExtraction(
  prescriptionId: string,
  imageBase64: string,
  mediaType: string,
  userId: string
) {
  try {
    // Extract data using Claude
    const extractedData = await extractPrescriptionData(imageBase64, mediaType);

    // Create medications from extracted data
    const medications = await Promise.all(
      extractedData.medications.map((med) =>
        prisma.medication.create({
          data: {
            userId,
            prescriptionId,
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            instructions: med.instructions,
            prescribingDoctor: extractedData.doctorInfo?.name,
            timeSlots: parseTimeSlots(med.frequency),
            isActive: true,
          },
        })
      )
    );

    // Create appointments from extracted data
    if (extractedData.appointments && extractedData.appointments.length > 0) {
      await Promise.all(
        extractedData.appointments.map((apt) => {
          if (apt.date && apt.date !== 'not_specified') {
            return prisma.appointment.create({
              data: {
                userId,
                doctorName: extractedData.doctorInfo?.name || 'Follow-up appointment',
                hospital: extractedData.doctorInfo?.hospital,
                specialty: extractedData.doctorInfo?.specialty,
                datetime: new Date(apt.date),
                notes: apt.notes,
                status: 'upcoming',
              },
            });
          }
          return Promise.resolve();
        })
      );
    }

    // Update prescription status
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'processed',
        extractedData: extractedData as any,
      },
    });

    console.log(`Prescription ${prescriptionId} processed successfully. Created ${medications.length} medications.`);
  } catch (error) {
    console.error(`Failed to process prescription ${prescriptionId}:`, error);
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status: 'failed' },
    });
  }
}

function parseTimeSlots(frequency: string): string[] {
  const lower = frequency.toLowerCase();
  
  // Common patterns
  if (lower.includes('morning') && lower.includes('evening')) {
    return ['09:00', '20:00'];
  }
  if (lower.includes('morning') && lower.includes('afternoon') && lower.includes('night')) {
    return ['09:00', '14:00', '21:00'];
  }
  if (lower.includes('morning')) {
    return ['09:00'];
  }
  if (lower.includes('evening') || lower.includes('night')) {
    return ['20:00'];
  }
  if (lower.includes('afternoon')) {
    return ['14:00'];
  }

  // Frequency codes
  if (lower.includes('od') || lower.includes('once')) {
    return ['09:00'];
  }
  if (lower.includes('bd') || lower.includes('twice')) {
    return ['09:00', '20:00'];
  }
  if (lower.includes('tds') || lower.includes('thrice') || lower.includes('three times')) {
    return ['09:00', '14:00', '20:00'];
  }
  if (lower.includes('qid') || lower.includes('four times')) {
    return ['08:00', '13:00', '18:00', '22:00'];
  }

  // Default
  return ['09:00'];
}
