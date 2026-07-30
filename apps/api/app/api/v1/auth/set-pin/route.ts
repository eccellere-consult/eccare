import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, hashPin } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'PIN must be 4-6 digits.' } },
      { status: 400 },
    );
  }

  const pinHash = await hashPin(parsed.data.pin);
  await prisma.user.update({ where: { id: auth.userId }, data: { pinHash } });

  return NextResponse.json({ success: true });
}
