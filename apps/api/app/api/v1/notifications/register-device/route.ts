import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1),
  platform: z.string().min(1),
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
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid request.' } },
      { status: 400 },
    );
  }

  const deviceToken = await prisma.deviceToken.upsert({
    where: { token: parsed.data.token },
    update: { userId: auth.userId, platform: parsed.data.platform },
    create: { userId: auth.userId, token: parsed.data.token, platform: parsed.data.platform },
  });

  return NextResponse.json({ success: true, data: deviceToken });
}
