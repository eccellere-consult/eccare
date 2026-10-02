import { NextResponse } from 'next/server';
import { isOtpConfigured } from '@/lib/otp';

/** Lets the login page decide whether to offer "sign in with a WhatsApp code" —
 *  false until the Meta Cloud API credentials are set, so the option never
 *  appears as a dead end. */
export async function GET() {
  return NextResponse.json({ success: true, data: { available: isOtpConfigured() } });
}
