import { NextRequest } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { name: true } },
      medications: {
        select: { id: true, name: true, dosage: true, frequency: true, timeSlots: true, instructions: true, isActive: true },
      },
    },
  });
  if (!prescription) return fail('NOT_FOUND', 'Prescription not found.', 404);

  const guard = await requireHealthAccess(req, prescription.userId);
  if (guard instanceof Response) return guard;

  return ok(prescription);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: { userId: true, filePath: true },
  });
  if (!prescription) return fail('NOT_FOUND', 'Prescription not found.', 404);

  const guard = await requireHealthAccess(req, prescription.userId);
  if (guard instanceof Response) return guard;

  if (guard.role === 'caregiver' && !guard.canManageMeds) {
    return fail('FORBIDDEN', 'You need medication management permission.', 403);
  }

  try {
    await unlink(path.join(process.cwd(), 'public', prescription.filePath));
  } catch {
    // file may already be gone
  }

  await prisma.prescription.delete({ where: { id } });

  return ok({ deleted: true });
}
