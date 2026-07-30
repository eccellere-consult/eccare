import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';

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
  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      name: body.name,
      language: body.language,
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
