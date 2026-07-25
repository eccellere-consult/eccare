import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  relationship: z.string().min(1),
  callOrder: z.number().int().min(1).optional(),
  notifyOnSos: z.boolean().optional(),
  elderUserId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;

  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: elderUserId },
    orderBy: { callOrder: 'asc' },
  });

  return NextResponse.json({ success: true, data: contacts });
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

  // Allow caregivers to add contacts for their linked elders
  const targetUserId = parsed.data.elderUserId || auth.userId;

  const contact = await prisma.emergencyContact.create({
    data: {
      userId: targetUserId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      relationship: parsed.data.relationship,
      callOrder: parsed.data.callOrder ?? 1,
      notifyOnSos: parsed.data.notifyOnSos ?? true,
    },
  });

  return NextResponse.json({ success: true, data: contact }, { status: 201 });
}
