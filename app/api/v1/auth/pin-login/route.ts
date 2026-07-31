import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, comparePin, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter your PIN.' } },
      { status: 400 },
    );
  }

  const { userId, pin } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.pinHash || !(await comparePin(pin, user.pinHash))) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PIN', message: 'Incorrect PIN.' } },
      { status: 401 },
    );
  }

  const token = await createToken(user.id, user.role);
  return NextResponse.json({ success: true, data: { user: toSafeUser(user), token } });
}
