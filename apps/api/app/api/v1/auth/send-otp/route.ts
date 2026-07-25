import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(10).max(15),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' } },
      { status: 400 },
    );
  }

  const { phone } = parsed.data;

  // TODO: Integrate SMS provider (MSG91/Twilio) to send OTP
  // For development, OTP is hardcoded as 123456
  const otp = process.env.NODE_ENV === 'production' ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';

  // TODO: Store OTP in cache (Redis) or temp table with expiry
  // For now, we'll verify against hardcoded value in dev

  return NextResponse.json({
    success: true,
    data: { message: 'OTP sent successfully.' },
  });
}
