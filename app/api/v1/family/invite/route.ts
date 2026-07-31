import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  elderEmail: z.string().email(),
  elderName: z.string().min(1),
  relationship: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }
  if (auth.role !== 'caregiver') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only family members can send invites.' } },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please fill in all fields.' } },
      { status: 400 },
    );
  }

  const { elderEmail, elderName, relationship } = parsed.data;

  // Find the elder's account, or pre-create a placeholder that gets claimed
  // automatically the first time they register with this email address.
  let elder = await prisma.user.findUnique({ where: { email: elderEmail } });
  if (!elder) {
    elder = await prisma.user.create({
      data: { email: elderEmail, name: elderName, role: 'elder' },
    });
  }

  if (elder.role !== 'elder') {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_AN_ELDER', message: 'This email is not registered as an elder.' } },
      { status: 409 },
    );
  }

  const existingRelation = await prisma.familyRelation.findUnique({
    where: { elderUserId_caregiverUserId: { elderUserId: elder.id, caregiverUserId: auth.userId } },
  });
  if (existingRelation) {
    return NextResponse.json(
      { success: false, error: { code: 'ALREADY_INVITED', message: 'You have already invited this person.' } },
      { status: 409 },
    );
  }

  const relation = await prisma.familyRelation.create({
    data: {
      elderUserId: elder.id,
      caregiverUserId: auth.userId,
      relationship,
      inviteStatus: 'pending',
    },
    include: { elderUser: true },
  });

  return NextResponse.json(
    { success: true, data: { ...relation, elderUser: toSafeUser(relation.elderUser) } },
    { status: 201 },
  );
}
