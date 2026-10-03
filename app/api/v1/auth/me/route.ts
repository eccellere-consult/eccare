import { checkDateOfBirth, DOB_ERROR_MESSAGES } from '@/lib/age';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { isSupportedLanguage } from '@/lib/i18n/languages';
import { isValidEmail, isValidAnyPhone, isInternationalPhone, normalizeAnyPhone, EMAIL_FORMAT_MESSAGE, ANY_PHONE_FORMAT_MESSAGE, INTERNATIONAL_ROLE_MESSAGE } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      emergencyContacts: { orderBy: { callOrder: 'asc' } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: toSafeUser(user) });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();

  if (body.language !== undefined && !isSupportedLanguage(body.language)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid language.' } },
      { status: 400 },
    );
  }
  if (body.secondaryLanguage != null && !isSupportedLanguage(body.secondaryLanguage)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid secondary language.' } },
      { status: 400 },
    );
  }
  // Date of birth: accounts that pre-date the age rule can add one (once). After
  // that it's locked — if it could be edited, the age rule could be dodged by
  // simply changing it — and only an admin can correct it.
  let dateOfBirthToSet: Date | undefined;
  if (body.dateOfBirth !== undefined && body.dateOfBirth !== null && body.dateOfBirth !== '') {
    const check = checkDateOfBirth(String(body.dateOfBirth));
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: DOB_ERROR_MESSAGES[check.reason] } },
        { status: 400 },
      );
    }
    const current = await prisma.user.findUnique({ where: { id: auth.userId }, select: { dateOfBirth: true } });
    if (current?.dateOfBirth) {
      if (current.dateOfBirth.getTime() !== check.dob.getTime()) {
        return NextResponse.json(
          { success: false, error: { code: 'DOB_LOCKED', message: 'Your date of birth is already on record and can only be changed by an admin.' } },
          { status: 403 },
        );
      }
    } else {
      dateOfBirthToSet = check.dob;
    }
  }
  // An empty string means the field was cleared in the form — treat that as "unset"
  // (null), not as an invalid format for whatever was typed.
  const email = body.email === '' ? null : body.email;
  const phone = body.phone === '' ? null : body.phone;

  if (email != null && !isValidEmail(email)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: EMAIL_FORMAT_MESSAGE } },
      { status: 400 },
    );
  }
  if (phone != null && !isValidAnyPhone(phone)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: ANY_PHONE_FORMAT_MESSAGE } },
      { status: 400 },
    );
  }
  // A non-Indian number is for family accounts only (see register).
  if (phone != null && isInternationalPhone(phone) && auth.role !== 'caregiver') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: INTERNATIONAL_ROLE_MESSAGE } },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        name: body.name,
        ...(dateOfBirthToSet ? { dateOfBirth: dateOfBirthToSet } : {}),
        email,
        phone: phone != null ? normalizeAnyPhone(phone) : phone,
        language: body.language,
        secondaryLanguage: body.secondaryLanguage,
        fontSizePref: body.fontSizePref,
        highContrast: body.highContrast,
        voiceEnabled: body.voiceEnabled,
        bloodGroup: body.bloodGroup,
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
      },
    });

    return NextResponse.json({ success: true, data: toSafeUser(user) });
  } catch (err) {
    // Prisma P2002 — unique constraint (email or phone already used by another account).
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_IN_USE', message: 'That email or phone number is already in use.' } },
        { status: 409 },
      );
    }
    throw err;
  }
}
