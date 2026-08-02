import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { isSupportedLanguage } from '@/lib/i18n/languages';

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

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      name: body.name,
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
}
