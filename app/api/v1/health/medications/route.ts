import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string(),
  timeSlots: z.array(z.string()),
  instructions: z.string().optional(),
  prescribingDoctor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const medications = await prisma.medication.findMany({
    where: { userId: auth.userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: medications });
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please fill in all required fields.' } },
      { status: 400 },
    );
  }

  // Allow caregivers to add meds for their linked elders
  const targetUserId = body.elderUserId || auth.userId;

  const medication = await prisma.medication.create({
    data: {
      userId: targetUserId,
      ...parsed.data,
    },
  });

  return NextResponse.json({ success: true, data: medication }, { status: 201 });
}
