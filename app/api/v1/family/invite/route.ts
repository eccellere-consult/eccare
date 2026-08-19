import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { z } from 'zod';
import { isValidEmail, isValidPhone, normalizePhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';

const schema = z
  .object({
    elderPhone: z.string().refine(isValidPhone, PHONE_FORMAT_MESSAGE).optional(),
    elderEmail: z.string().refine(isValidEmail, EMAIL_FORMAT_MESSAGE).optional(),
    elderName: z.string().min(1),
    relationship: z.string().min(1),
  })
  .refine((data) => !!(data.elderPhone || data.elderEmail), {
    message: "Please enter the elder's phone number or email address.",
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
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please fill in all fields.' } },
      { status: 400 },
    );
  }

  const { elderName, relationship } = parsed.data;
  const elderEmail = parsed.data.elderEmail;
  const elderPhone = parsed.data.elderPhone ? normalizePhone(parsed.data.elderPhone) : undefined;

  // Find the elder's account by whichever identifier was given — phone first,
  // since it's the primary identifier — or pre-create a placeholder that gets
  // claimed automatically the first time they register with this phone/email.
  const existingByPhone = elderPhone ? await prisma.user.findUnique({ where: { phone: elderPhone } }) : null;
  const existingByEmail = elderEmail && !existingByPhone ? await prisma.user.findUnique({ where: { email: elderEmail } }) : null;
  let elder = existingByPhone ?? existingByEmail;

  if (!elder) {
    elder = await prisma.user.create({
      data: { phone: elderPhone, email: elderEmail, name: elderName, role: 'elder' },
    });
  }

  if (elder.role !== 'elder') {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_AN_ELDER', message: 'This phone number or email is not registered as an elder.' } },
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
