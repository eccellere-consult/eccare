import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const createSchema = z.object({
  elderUserId: z.string().optional(),
  category: z.enum(['legal_will', 'reverse_mortgage', 'senior_insurance']),
  requirementDetails: z.record(z.string(), z.unknown()),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's consultations.", 403);
  }

  const consultations = await prisma.consultationRequest.findMany({
    where: { elderUserId },
    include: { assignedExpert: true, documents: { select: { id: true, fileName: true, filePath: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: consultations });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0]?.message || 'Please check the details.', 400);

  const elderUserId = parsed.data.elderUserId || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's consultations.", 403);
  }

  const consultation = await prisma.consultationRequest.create({
    data: {
      elderUserId,
      requestedById: auth.userId,
      category: parsed.data.category,
      requirementDetails: parsed.data.requirementDetails as Prisma.InputJsonValue,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ success: true, data: consultation }, { status: 201 });
}
