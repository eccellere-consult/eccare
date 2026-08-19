import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { isSupportedLanguage } from '@/lib/i18n/languages';
import { isValidEmail, isValidPhone, normalizePhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';

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
  if (phone != null && !isValidPhone(phone)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: PHONE_FORMAT_MESSAGE } },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        name: body.name,
        email,
        phone: phone != null ? normalizePhone(phone) : phone,
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
